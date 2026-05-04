

function getWorkerUrl_() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("WORKER_URL");
}

function getWorkerSecret_() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("WORKER_API_KEY");
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




function log_(functionName, genericError, fullError) {
  var message = "[" + functionName + "] " + genericError + " | Details: " + fullError;
  Logger.log(message);

  var workerUrl = getWorkerUrl();
  var secret = getWorkerSecret();
  if (workerUrl && secret) {
    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + secret,
      },
      payload: JSON.stringify({
        function_name: functionName,
        error_summary: genericError,
        full_error: fullError,
        timestamp: new Date().toISOString(),
      }),
      muteHttpExceptions: true,
    };
    try {
      UrlFetchApp.fetch(workerUrl + "/api/logs", options);
    } catch (e) {
      Logger.log("Failed to send log to worker: " + e.toString());
    }
  }
}
