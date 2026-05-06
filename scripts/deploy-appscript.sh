#!/bin/bash
# scripts/deploy-appscript.sh
# Dual-deployment script for Google Apps Script environments.

set -e

if ! command -v npx &> /dev/null
then
    echo "Error: npx could not be found. Please ensure Node.js is installed."
    exit 1
fi

GMAIL_SCRIPT_ID="${APPSCRIPT_PROJECT_ID_GMAIL}"
COLBY_SCRIPT_ID="${APPSCRIPT_PROJECT_ID_126COLBY}"
TARGET="${TARGET_PROJECT:-both}"

if [ -z "$GMAIL_SCRIPT_ID" ] || [ -z "$COLBY_SCRIPT_ID" ]; then
  echo "Error: Both APPSCRIPT_PROJECT_ID_GMAIL and APPSCRIPT_PROJECT_ID_126COLBY environment variables must be populated."
  exit 1
fi

# Initialize the Step Summary Header for clickable links in the GitHub UI
if [ -n "$GITHUB_STEP_SUMMARY" ]; then
  echo "### 🚀 Apps Script Deployments" >> "$GITHUB_STEP_SUMMARY"
fi

deploy_to_target() {
  local script_id=$1
  local env_name=$2

  echo "Starting deployment to $env_name..."

  cat > appscript/.clasp.json <<EOF
{
  "scriptId": "$script_id",
  "rootDir": "."
}
EOF

  echo "Generated .clasp.json for $env_name"

  # Navigate to appscript directory and push
  cd appscript
  npx clasp push --force
  cd ..

  echo "Successfully deployed to $env_name"
  echo "=================================================="
  echo "🚀 APPS SCRIPT EDITOR URL: $env_name"
  echo "https://script.google.com/d/$script_id/edit"
  echo "=================================================="
  
  # Append directly to the GitHub Step Summary to create a hyperlink widget in the UI
  if [ -n "$GITHUB_STEP_SUMMARY" ]; then
    echo "- **$env_name**: [Open in Editor](https://script.google.com/d/$script_id/edit)" >> "$GITHUB_STEP_SUMMARY"
  fi
}

echo "========================================"
echo "Google Apps Script Deployment"
echo "Target: $TARGET"
echo "========================================"
echo ""

if [ "$TARGET" = "gmail" ] || [ "$TARGET" = "both" ]; then
  deploy_to_target "$GMAIL_SCRIPT_ID" "Gmail Project"
fi

if [ "$TARGET" = "126colby" ] || [ "$TARGET" = "both" ]; then
  deploy_to_target "$COLBY_SCRIPT_ID" "126Colby Project"
fi

echo "========================================"
echo "All deployments completed successfully!"
echo "========================================"
