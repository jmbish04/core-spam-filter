const SPAM_LABEL_NAME = "AI_Spam";


function configureScriptApp(){
  setConfig_('https://core-spam-filter.hacolby.workers.dev', '');
  createTrigger_();
}

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


