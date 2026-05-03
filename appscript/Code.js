var SPAM_LABEL_NAME = "AI_Spam";

function getWorkerUrl() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("WORKER_URL");
}

function getWorkerSecret() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("WORKER_API_KEY");
}

function processRecentEmails_() {
  var label = getOrCreateLabel_(SPAM_LABEL_NAME);

  // Search for emails in Inbox from the last 24 hours
  var threads = GmailApp.search("in:inbox newer_than:1d -label:" + SPAM_LABEL_NAME);

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];

      var payload = {
        message_id: msg.getId(),
        sender: msg.getFrom(),
        recipient: msg.getTo(),
        cc: msg.getCc() || "",
        bcc: msg.getBcc() || "",
        subject: msg.getSubject(),
        body: msg.getPlainBody() || msg.getBody(),
        date: msg.getDate().toISOString(),
      };

      var result = analyzeEmail_(payload);

      if (result && result.spam) {
        msg.getThread().addLabel(label);
      }
    }
  }
}

function analyzeEmail_(payload) {
  var url = getWorkerUrl() + "/api/emails/analyze";
  var secret = getWorkerSecret();

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + secret,
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
        response.getContentText(),
      );
      return null;
    }
  } catch (e) {
    log_("analyzeEmail_", "Fetch failed", e.toString());
    return null;
  }
}

function getOrCreateLabel_(labelName) {
  var label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  return label;
}

function createTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processRecentEmails_") {
      Logger.log("Trigger already exists.");
      return;
    }
  }

  ScriptApp.newTrigger("processRecentEmails_").timeBased().everyHours(1).create();
  Logger.log("Trigger created successfully.");
}

function setConfig_(workerUrl, workerApiKey) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("WORKER_URL", workerUrl);
  props.setProperty("WORKER_API_KEY", workerApiKey);
}
