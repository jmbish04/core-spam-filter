function onHomepage(e) {
  const card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("Core Spam Filter Settings"));

  const sweepSection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Sweep inbox for spam right now."))
    .addWidget(
      CardService.newTextButton()
        .setText("Trigger Spam Sweep")
        .setOnClickAction(CardService.newAction().setFunctionName("runManualSweep_")),
    );

  const configSection = CardService.newCardSection()
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
  const messageId = e.messageMetadata.messageId;

  const card = CardService.newCardBuilder();
  card.setHeader(CardService.newCardHeader().setTitle("Message Actions"));

  const section = CardService.newCardSection()
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
    log_("runManualSweep", "Manual sweep failed", err.toString());
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText("Sweep failed"))
      .build();
  }
}

function saveConfig_(e) {
  const workerUrl = e.formInput.workerUrl;
  const workerApiKey = e.formInput.workerApiKey;
  setConfig_(workerUrl, workerApiKey);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Configuration saved."))
    .build();
}

function addDomainToSpamConfig_(e) {
  const messageId = e.parameters.messageId;
  const msg = GmailApp.getMessageById(messageId);
  const sender = msg.getFrom();

  const domainMatch = sender.match(/@([\w.-]+)/);
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
  const messageId = e.parameters.messageId;
  const msg = GmailApp.getMessageById(messageId);
  const sender = msg.getFrom();

  const emailMatch = sender.match(/<([^>]+)>/);
  const email = emailMatch ? emailMatch[1] : sender;

  addRuleToWorker_("email", "safe", email);
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText("Added " + email + " to Safe config."))
    .build();
}

function askAgent_(e) {
  const messageId = e.parameters.messageId;
  const question = e.formInput.agentQuestion;
  const msg = GmailApp.getMessageById(messageId);
  const payload = {
    message_id: messageId,
    sender: msg.getFrom(),
    recipient: msg.getTo(),
    subject: msg.getSubject(),
    body: msg.getPlainBody() || msg.getBody(),
    question: question,
  };

  const url = `${getWorkerUrl_()}/api/emails/ask`; // New theoretical endpoint for custom agent Q&A
  const secret = getWorkerSecret_();

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + secret,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
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

function addRuleToWorker_(ruleType, classification, value) {
  const url = `${getWorkerUrl_()}/api/rules`;
  const secret = getWorkerSecret_();

  const payload = {
    rule_type: ruleType,
    classification: classification,
    value: value,
  };

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + secret,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
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
