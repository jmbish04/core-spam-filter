// Trigger management functions
// All functions marked with _ are private

function createTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processRecentEmails_") {
      console.log("Trigger already exists.");
      return;
    }
  }

  ScriptApp.newTrigger("processRecentEmails_").timeBased().everyHours(1).create();
  console.log("Trigger created successfully.");
}

function deleteTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "processRecentEmails_") {
      ScriptApp.deleteTrigger(triggers[i]);
      console.log("Trigger deleted.");
      return;
    }
  }
  console.log("No trigger found to delete.");
}
