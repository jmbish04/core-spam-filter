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
