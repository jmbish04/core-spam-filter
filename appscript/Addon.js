// Gmail Addon UI functions
// All functions marked with _ are private

function onHomepage(e) {
  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("Core Spam Filter Settings"));

  var sweepSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Sweep inbox for spam right now."))
    .addWidget(
      CardService.newTextButton()
        .setText("Trigger Spam Sweep")
        .setOnClickAction(CardService.newAction().setFunctionName("runManualSweep_")),
    );

  var configSection = CardService.newCardSection()
    .setHeader("Configuration")
    .addWidget(
      CardService.newTextInput()
        .setFieldName("workerUrl")
        .setTitle("Worker URL")
        .setValue(getWorkerUrl_() || ""),
    )
    .addWidget(
      CardService.newTextInput()
        .setFieldName("workerApiKey")
        .setTitle("Worker API Key")
        .setValue(getWorkerSecret_() || ""),
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Save Configuration")
        .setOnClickAction(CardService.newAction().setFunctionName("saveConfig_")),
    );

  card.addSection(sweepSection);
  card.addSection(configSection);
  return card.build();
}

function onContextualMessage(e) {
  var messageId = e.messageMetadata.messageId;

  var card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("Message Actions"));

  var section = CardService.newCardSection()
    .addWidget(
      CardService.newTextButton()
        .setText("Add sender domain to Spam config")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("addDomainToSpamConfig_")
            .setParameters({ messageId: messageId }),
        ),
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Add sender to Safe config")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("addSenderToSafeConfig_")
            .setParameters({ messageId: messageId }),
        ),
    )
    .addWidget(
      CardService.newTextInput().setFieldName("agentQuestion").setTitle("Ask Agent (Contextual)"),
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Send to Agent")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("askAgent_")
            .setParameters({ messageId: messageId }),
        ),
    );

  card.addSection(section);
  return [card.build()];
}

function runManualSweep_(e) {
  try {
    processRecentEmails_();
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Sweep completed."))
      .build();
  } catch (err) {
    log_("runManualSweep_", "Manual sweep failed", err.toString());
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Sweep failed"))
      .build();
  }
}

function saveConfig_(e) {
  var workerUrl = e.formInput.workerUrl;
  var workerApiKey = e.formInput.workerApiKey;
  setConfig(workerUrl, workerApiKey);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Configuration saved."))
    .build();
}

function addDomainToSpamConfig_(e) {
  var messageId = e.parameters.messageId;
  var msg = GmailApp.getMessageById(messageId);
  var sender = msg.getFrom();

  var domainMatch = sender.match(/@([\w.-]+)/);
  if (domainMatch && domainMatch[1]) {
    addRuleToWorker_("domain", "spam", domainMatch[1]);
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("Added " + domainMatch[1] + " to Spam config."),
      )
      .build();
  }
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Could not parse domain"))
    .build();
}

function addSenderToSafeConfig_(e) {
  var messageId = e.parameters.messageId;
  var msg = GmailApp.getMessageById(messageId);
  var sender = msg.getFrom();

  var emailMatch = sender.match(/<([^>]+)>/);
  var email = emailMatch ? emailMatch[1] : sender;

  addRuleToWorker_("email", "safe", email);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Added " + email + " to Safe config."))
    .build();
}

function askAgent_(e) {
  var messageId = e.parameters.messageId;
  var question = e.formInput.agentQuestion;
  var msg = GmailApp.getMessageById(messageId);
  var inboxAccount = getEffectiveInboxAddress_();

  var payload = {
    message_id: messageId,
    inbox_account: inboxAccount,
    sender: msg.getFrom(),
    recipient: msg.getTo(),
    subject: msg.getSubject(),
    body: msg.getPlainBody() || msg.getBody(),
    question: question,
  };

  var url = getWorkerUrl_() + "/api/emails/ask";
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
      var data = JSON.parse(response.getContentText());
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification().setText(data.answer))
        .build();
    } else {
      log_(
        "askAgent_",
        "Agent Q&A returned " + response.getResponseCode(),
        response.getContentText(),
      );
    }
  } catch (err) {
    log_("askAgent_", "Failed to ask agent", err.toString());
  }

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Failed to reach agent"))
    .build();
}
