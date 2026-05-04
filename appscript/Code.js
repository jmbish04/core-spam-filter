/**
 * @fileoverview 
 * Core Spam Filter script for Google Workspace. This module handles the automated 
 * integration between Gmail and an external Cloudflare Worker API. It provides 
 * functions to initialize hourly triggers and sweep the user's inbox for recent 
 * emails, forwarding their contents to the Worker for spam classification and 
 * appropriately labeling the threads in Gmail.
 */


/**
 * The name of the Gmail label applied to messages identified as spam.
 * @constant {string}
 */
const SPAM_LABEL_NAME = "AI_Spam";

/**
 * Initializes the Script App configuration by setting the default Worker URL
 * and creating the hourly processing trigger.
 * * @returns {void}
 */
function configureScriptApp(){
  setConfig_('https://core-spam-filter.hacolby.workers.dev', '');
  createTrigger_();
}

/**
 * Searches the user's inbox for emails received in the last 24 hours that 
 * have not yet been labeled as spam. Sends each message to the Worker API 
 * for analysis and applies the spam label if the API flags it.
 * * @returns {void}
 */
function processRecentEmails() {
  const label = getOrCreateLabel_(SPAM_LABEL_NAME);

  // Search for emails in Inbox from the last 24 hours
  const threads = GmailApp.search(`in:inbox newer_than:1d -label: ${SPAM_LABEL_NAME}`);

  for (let i = 0; i < threads.length; i++) {
    const messages = threads[i].getMessages();
    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];

      const payload = {
        message_id: msg.getId(),
        sender: msg.getFrom(),
        recipient: msg.getTo(),
        cc: msg.getCc() || "",
        bcc: msg.getBcc() || "",
        subject: msg.getSubject(),
        body: msg.getPlainBody() || msg.getBody(),
        date: msg.getDate().toISOString(),
      };

      const result = analyzeEmail_(payload);

      if (result && result.spam) {
        msg.getThread().addLabel(label);
      }
    }
  }
}
