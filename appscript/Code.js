/**
 * @fileoverview 
 * Core Spam Filter script for Google Workspace. This module handles the automated 
 * integration between Gmail and the Cloudflare Worker API. It provides functions to 
 * initialize hourly triggers and sweep the inbox, forwarding emails to the Worker for 
 * AI spam classification and draft generation, then applying appropriate Gmail labels.
 *
 * The Worker now handles all AI analysis (spam scoring, draft reply generation, and
 * writing-style selection).  This script is responsible only for Gmail orchestration.
 *
 * Web-app entry point (doPost) provides a Gmail-search pseudo-API consumed by the
 * Worker's /api/gmail/search proxy so the configuration UI can preview which emails
 * match a given set of writing-style conditions.
 */

const SPAM_LABEL_NAME         = "AI_Spam";
const DRAFTED_LABEL_NAME      = "🤖 AI-Drafted";
const MANUAL_REPLY_LABEL_NAME = "✍️ Needs-Manual-Reply";
const NO_REPLY_LABEL_NAME     = "⛔️ No-Reply-Needed";
const NEW_EMAIL_LABEL_NAME    = "🆕 New-Email";

// ── Web-App entry point (Gmail search pseudo-API) ─────────────────────────────

/**
 * HTTP POST entry point when the AppScript is deployed as a web app.
 * Accepts a JSON body with { action, conditions, max_results } and returns
 * matching Gmail messages for the requesting Cloudflare Worker.
 *
 * Authentication: a shared secret stored in ScriptProperties under
 * "APPSCRIPT_WEBHOOK_SECRET" is compared to the Authorization Bearer header.
 *
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  var props = PropertiesService.getScriptProperties();
  var expectedSecret = props.getProperty('APPSCRIPT_WEBHOOK_SECRET');

  if (expectedSecret) {
    var authHeader = e.parameter.Authorization ||
      (e.headers && e.headers['Authorization']) || '';
    var providedToken = authHeader.replace(/^Bearer\s+/i, '');
    if (providedToken !== expectedSecret) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (body.action === 'search_gmail') {
    var result = searchGmailByConditions_(body.conditions || [], body.max_results || 10);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Gmail search helper ───────────────────────────────────────────────────────

/**
 * Converts an array of writing-style conditions into a Gmail search query
 * and returns the first maxResults matching messages' metadata.
 *
 * @param {Array<{condition_field:string, condition_operator:string, condition_value:string}>} conditions
 * @param {number} maxResults
 * @returns {{ messages: object[], query: string, total: number }}
 */
function searchGmailByConditions_(conditions, maxResults) {
  var queryParts = ['in:inbox'];

  for (var i = 0; i < conditions.length; i++) {
    var cond = conditions[i];
    var field = cond.condition_field;
    var op    = cond.condition_operator;
    var val   = cond.condition_value;

    switch (field) {
      case 'from_address':
        if (op === 'equals')     queryParts.push('from:' + val);
        else if (op === 'contains') queryParts.push('from:' + val);
        else if (op === 'not_contains') queryParts.push('-from:' + val);
        break;

      case 'from_domain':
        var domainVal = val.replace(/^@/, '');
        if (op === 'equals' || op === 'contains')
          queryParts.push('from:@' + domainVal);
        else if (op === 'not_contains')
          queryParts.push('-from:@' + domainVal);
        break;

      case 'to_address':
        if (op === 'equals' || op === 'contains')
          queryParts.push('to:' + val);
        else if (op === 'not_contains')
          queryParts.push('-to:' + val);
        break;

      case 'subject':
        if (op === 'contains')   queryParts.push('subject:' + val);
        else if (op === 'equals') queryParts.push('subject:"' + val + '"');
        else if (op === 'not_contains') queryParts.push('-subject:' + val);
        break;

      case 'body':
        if (op === 'contains')   queryParts.push(val);
        else if (op === 'not_contains') queryParts.push('-' + val);
        break;

      case 'cc':
        if (op === 'contains' || op === 'equals') queryParts.push('cc:' + val);
        break;
    }
  }

  var query = queryParts.join(' ');
  var threads = GmailApp.search(query, 0, maxResults);
  var messages = [];

  for (var t = 0; t < threads.length; t++) {
    var thread = threads[t];
    var msg = thread.getMessages()[thread.getMessageCount() - 1];
    messages.push({
      id: msg.getId(),
      thread_id: thread.getId(),
      sender: msg.getFrom(),
      subject: msg.getSubject(),
      snippet: msg.getPlainBody().substring(0, 150),
      date: msg.getDate().toISOString(),
    });
  }

  return { messages: messages, query: query, total: messages.length };
}

// ── Configuration & triggers ──────────────────────────────────────────────────

/**
 * Initializes the script: sets the Worker URL and creates the hourly trigger.
 */
function configureScriptApp() {
  setConfig_('https://core-spam-filter.hacolby.workers.dev', '');
  createTrigger_();
}

// ── Main processing loop ──────────────────────────────────────────────────────

/**
 * Sweeps the inbox for recent emails not yet labeled as spam, sends each to the
 * Worker for AI analysis, then applies the appropriate Gmail label and creates
 * draft replies where the AI has generated one.
 */
function processRecentEmails() {
  var spamLabel    = getOrCreateLabel_(SPAM_LABEL_NAME);
  var draftedLabel = getOrCreateLabel_(DRAFTED_LABEL_NAME);
  var manualLabel  = getOrCreateLabel_(MANUAL_REPLY_LABEL_NAME);
  var noReplyLabel = getOrCreateLabel_(NO_REPLY_LABEL_NAME);
  var newLabel     = GmailApp.getUserLabelByName(NEW_EMAIL_LABEL_NAME);

  // Search strategy: labelled NEW-EMAIL if the label exists, else recent inbox
  var threads;
  if (newLabel) {
    threads = newLabel.getThreads();
  } else {
    threads = GmailApp.search('in:inbox newer_than:1d -label:' + SPAM_LABEL_NAME);
  }

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    try {
      var messages = thread.getMessages();
      var msg      = messages[messages.length - 1]; // analyse the most recent message

      var payload = {
        account_email: getCurrentAccount_(),
        message_id:    msg.getId(),
        sender:        msg.getFrom(),
        recipient:     msg.getTo(),
        cc:            msg.getCc() || '',
        bcc:           msg.getBcc() || '',
        subject:       msg.getSubject(),
        body:          msg.getPlainBody() || msg.getBody(),
        date:          msg.getDate().toISOString(),
      };

      var result = analyzeEmail_(payload);

      if (!result) {
        // Worker unreachable – mark for manual review and continue
        cleanupDecisionLabels_(thread, [draftedLabel, noReplyLabel]);
        thread.addLabel(manualLabel);
        continue;
      }

      // Remove previous decision labels before applying new ones
      cleanupDecisionLabels_(thread, [spamLabel, draftedLabel, manualLabel, noReplyLabel]);

      if (result.spam) {
        // ── Spam ─────────────────────────────────────────────────────────────
        thread.addLabel(spamLabel);

      } else if (result.is_answerable && result.draft_reply) {
        // ── AI drafted a reply ────────────────────────────────────────────────
        var htmlBody = result.draft_reply.replace(/\n/g, '<br>');
        thread.createDraftReplyAll('', { htmlBody: htmlBody });
        thread.addLabel(draftedLabel);

      } else if (result.no_reply_needed) {
        // ── No reply required (newsletter / receipt / etc.) ───────────────────
        thread.addLabel(noReplyLabel);

      } else {
        // ── Needs human attention ─────────────────────────────────────────────
        thread.addLabel(manualLabel);
      }

      // Remove NEW-EMAIL label once processed
      if (newLabel) {
        thread.removeLabel(newLabel);
      }

    } catch (err) {
      log_('processRecentEmails', 'Failed to process thread ' + thread.getId(), err.toString());
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Removes an array of labels from a thread (used to clean up before applying
 * the new decision label so labels do not accumulate).
 *
 * @param {GoogleAppsScript.Gmail.GmailThread} thread
 * @param {GoogleAppsScript.Gmail.GmailLabel[]} labels
 */
function cleanupDecisionLabels_(thread, labels) {
  var threadLabels = thread.getLabels();
  for (var i = 0; i < labels.length; i++) {
    for (var j = 0; j < threadLabels.length; j++) {
      if (threadLabels[j].getName() === labels[i].getName()) {
        thread.removeLabel(labels[i]);
        break;
      }
    }
  }
}
