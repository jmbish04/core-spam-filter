// Configuration management for the spam filter
// All functions marked with _ are private and won't appear in GAS UI dropdown

function getWorkerUrl_() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("WORKER_URL");
}

function getWorkerSecret_() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty("WORKER_API_KEY");
}

function getEffectiveInboxAddress_() {
  return Session.getEffectiveUser().getEmail();
}

function getSpamLabelName_() {
  return "AI_Spam";
}

function setConfig(workerUrl, workerApiKey) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("WORKER_URL", workerUrl);
  props.setProperty("WORKER_API_KEY", workerApiKey);
  console.log("Configuration saved for worker URL: " + workerUrl);
}
