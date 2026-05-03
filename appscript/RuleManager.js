// Rule management functions for interacting with worker API
// All functions marked with _ are private

function addRuleToWorker_(ruleType, classification, value) {
  var url = getWorkerUrl_() + "/api/rules";
  var secret = getWorkerSecret_();
  var inboxAccount = getEffectiveInboxAddress_();

  var payload = {
    rule_type: ruleType,
    classification: classification,
    value: value,
  };

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
    var res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() !== 201 && res.getResponseCode() !== 200) {
      log_(
        "addRuleToWorker_",
        "Adding rule returned " + res.getResponseCode(),
        res.getContentText(),
      );
    }
  } catch (err) {
    log_("addRuleToWorker_", "Failed to add rule", err.toString());
  }
}
