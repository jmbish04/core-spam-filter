// Code.gs - Main entry point and simple executor
// This file provides user-accessible functions and triggers

// User-accessible function to set configuration
function setWorkerConfig() {
  var ui = SpreadsheetApp.getUi(); // For testing in Sheets, or use console
  console.log("Use setConfig(workerUrl, workerApiKey) to configure");
  console.log(
    "Example: setConfig('https://core-spam-filter.hacolby.workers.dev', 'your-api-key')",
  );
}

// User-accessible function to create the time-based trigger
function setupTrigger() {
  createTrigger();
}

// User-accessible function to run a manual spam sweep
function runJob() {
  processRecentEmails_();
  console.log("Manual spam sweep completed");
}
