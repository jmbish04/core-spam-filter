/**
 * @fileoverview
 * Utility and helper functions for the Core Spam Filter system. 
 * This file handles internal script operations including property management, 
 * Gmail label creation, trigger initialization, remote error logging, and 
 * executing HTTP requests to the external Cloudflare Worker API for email analysis.
 */

/**
 * Retrieves the Worker URL from script properties.
 * @returns {string|null} The configured Worker URL, or null if not set.
 * @private
 */
function getWorkerUrl_() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("WORKER_URL");
}

/**
 * Retrieves the Worker API Key (secret) from script properties.
 * @returns {string|null} The configured Worker API Key, or null if not set.
 * @private
 */
function getWorkerSecret_() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("WORKER_API_KEY");
}

/**
 * Retrieves the email associated with this appscript.
 * @returns {string|null} The active user's email used for execution & authorization with Google Services.
 * @private
 */
function getActiveAccount_(){
  return Session.getActiveUser().getEmail();
}

/**
 * Retrieves the scriptId of the current appscript.
 * @returns {string|null} The scriptId / driveId of the current AppsScript associated with this conference.
 * @private
 */
function getScriptId_(){
  return ScriptApp.getScriptId();
}

/**
 * Sends an email payload to the external Worker API for spam analysis.
 * @param {Object} payload - An object containing email metadata and body content.
 * @param {string} payload.message_id - The unique ID of the email message.
 * @param {string} payload.sender - The sender's email address.
 * @param {string} payload.recipient - The recipient's email address.
 * @param {string} [payload.cc] - CC'd email addresses.
 * @param {string} [payload.bcc] - BCC'd email addresses.
 * @param {string} payload.subject - The subject of the email.
 * @param {string} payload.body - The plain text body of the email.
 * @param {string} payload.date - ISO string representation of the email date.
 * @returns {Object|null} The parsed JSON response from the API, or null if the request failed.
 * @private
 */
function analyzeEmail_(payload) {
  var url = `${getWorkerUrl_()}/api/emails/analyze`;
  var secret = getWorkerSecret_();

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${secret}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      log_(
        "analyzeEmail_",
        "API returned " + response.getResponseCode(),
        response.getContentText()
      );
      return null;
    }
  } catch (e) {
    log_("analyzeEmail_", "Fetch failed", e.toString());
    return null;
  }
}

/**
 * Retrieves an existing Gmail label by name, or creates it if it does not exist.
 * @param {string} labelName - The name of the label to retrieve or create.
 * @returns {GoogleAppsScript.Gmail.GmailLabel} The requested Gmail label object.
 * @private
 */
function getOrCreateLabel_(labelName) {
  var label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  return label;
}

/**
 * Creates a time-based trigger to run the processRecentEmails_ function every hour.
 * Checks if the trigger already exists to prevent duplicates.
 * @returns {void}
 * @private
 */
function createTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processRecentEmails_") {
      console.log("Trigger already exists.");
      return;
    }
  }

  ScriptApp.newTrigger("processRecentEmails_").timeBased().everyHours(1).create();
  console.log("Trigger created successfully.");
}

/**
 * Saves the external Worker URL and API Key to the script properties.
 * @param {string} workerUrl - The base URL of the Cloudflare Worker.
 * @param {string} workerApiKey - The authorization token for the Worker API.
 * @returns {void}
 * @private
 */
function setConfig_(workerUrl, workerApiKey) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("WORKER_URL", workerUrl);
  props.setProperty("WORKER_API_KEY", workerApiKey);
}

/**
 * Logs an error locally to the Apps Script logger and attempts to send the log 
 * to the configured external Worker API endpoint.
 * @param {string} functionName - The name of the function where the error occurred.
 * @param {string} genericError - A short summary of the error.
 * @param {string} fullError - The full error stack trace or detailed string.
 * @returns {void}
 * @private
 */
function log_(functionName, genericError, fullError) {
  const message = `[ ${functionName} ]: ${genericError} | Details: ${fullError}`;
  console.log(message);

  const workerUrl = getWorkerUrl_();
  const secret = getWorkerSecret_();
  if (workerUrl && secret) {
    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${secret}`
      },
      payload: JSON.stringify({
        function_name: functionName,
        error_summary: genericError,
        full_error: fullError,
        timestamp: getD1Timestamp_(),
      }),
      muteHttpExceptions: true,
    };
    try {
      UrlFetchApp.fetch(`${workerUrl}/api/logs`, options);
    } catch (e) {
      console.log(`Failed to send log to worker: ${e.toString()}`);
    }
  }
}

/**
 * Retrieves the email address of the user currently executing the script.
 * @returns {string} The email address of the effective user.
 * @private
 */
function getCurrentAccount_(){
  return Session.getEffectiveUser().getEmail();
}

/**
 * Retrieves the D1 timestamp as 'YYYY-MM-DD HH:MM:SS in UTC'.
 * @returns {string}  YYYY-MM-DD HH:MM:SS in UTC
 * @private
 */
function getD1Timestamp_() {
  // Returns format: YYYY-MM-DD HH:MM:SS in UTC
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Retrieves the ISO8601 timestamp as 'YYYY-MM-DDTHH:MM:SS.SSSZ in UTC'.
 * @returns {string} YYYY-MM-DDTHH:MM:SS.SSSZ in UTC
 * @private
 */
function getISO8601Timestamp_() {
  // Returns format: YYYY-MM-DDTHH:MM:SS.SSSZ in UTC
  return new Date().toISOString();
}
