// Utility functions for logging
// All functions marked with _ are private

function log_(functionName, genericError, fullError) {
  var inboxAccount = getEffectiveInboxAddress_();
  var message =
    "[" + inboxAccount + "][" + functionName + "] " + genericError + " | Details: " + fullError;
  console.log(message);

  var workerUrl = getWorkerUrl_();
  var secret = getWorkerSecret_();
  if (workerUrl && secret) {
    var options = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + secret,
      },
      payload: JSON.stringify({
        inbox_account: inboxAccount,
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
      console.log("Failed to send log to worker: " + e.toString());
    }
  }
}

