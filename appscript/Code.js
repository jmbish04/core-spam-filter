// Configuration
const API_URL = "YOUR_CLOUDFLARE_WORKER_URL/api/emails/analyze"; // e.g. https://core-spam-filter.workers.dev/api/emails/analyze
const APPS_SCRIPT_SECRET = "YOUR_SECRET_TOKEN";
const SPAM_LABEL_NAME = "AI_Spam";

function processRecentEmails() {
  const label = getOrCreateLabel(SPAM_LABEL_NAME);

  // Search for emails in Inbox from the last 24 hours
  // 'newer_than:1d' ensures we only look at recent emails.
  // 'in:inbox' restricts to inbox (adjust if you want to scan all mail)
  const threads = GmailApp.search("in:inbox newer_than:1d -label:" + SPAM_LABEL_NAME);

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

      const result = analyzeEmail(payload);

      if (result && result.spam) {
        msg.getThread().addLabel(label);
        // Optionally, remove from inbox:
        // msg.getThread().moveToArchive();
      }
    }
  }
}

function analyzeEmail(payload) {
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + APPS_SCRIPT_SECRET,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(API_URL, options);
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      Logger.log("API Error: " + response.getResponseCode() + " " + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log("Fetch failed: " + e.toString());
    return null;
  }
}

function getOrCreateLabel(labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  return label;
}

// Function to set up the time-driven trigger (run this manually once)
function createTrigger() {
  // Check if trigger already exists to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processRecentEmails") {
      Logger.log("Trigger already exists.");
      return;
    }
  }

  // Create a trigger to run every hour (adjust frequency as needed)
  ScriptApp.newTrigger("processRecentEmails").timeBased().everyHours(1).create();
  Logger.log("Trigger created successfully.");
}
