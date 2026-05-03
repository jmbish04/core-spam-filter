// Email processing functions
// All functions marked with _ are private

function processRecentEmails_() {
  var label = getOrCreateLabel_(getSpamLabelName_());
  var inboxAccount = getEffectiveInboxAddress_();

  // Search for emails in Inbox from the last 24 hours
  var threads = GmailApp.search("in:inbox newer_than:1d -label:" + getSpamLabelName_());

  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];

      var payload = {
        message_id: msg.getId(),
        inbox_account: inboxAccount,
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
  var url = getWorkerUrl_() + "/api/emails/analyze";
  var secret = getWorkerSecret_();

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
