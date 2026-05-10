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

deploy_to_target() {
  local script_id=$1
  local env_name=$2
  local target_key=$3

  echo "Starting deployment to $env_name..."

  cat > appscript/.clasp.json <<EOF
{
  "scriptId": "$script_id",
  "rootDir": "."
}
EOF

  echo "Generated .clasp.json for $env_name"

  # Navigate to appscript directory and push
# Example logic for your bash script
if [ "$TARGET_PROJECT" == "gmail" ] || [ "$TARGET_PROJECT" == "both" ]; then
  cd appscript/gmail
  clasp push -f
  # REDEPLOY to the same ID to keep the same URL
  clasp deploy -i "$PROD_DEPLOYMENT_ID_GMAIL" -d "Automated Deploy $(date)"
  cd ../..
fi

  echo "Successfully deployed to $env_name"
  echo "---"
  
  # Export the outputs back to GitHub Actions
  if [ -n "$GITHUB_OUTPUT" ]; then
    echo "url_${target_key}=https://script.google.com/d/${script_id}/edit" >> "$GITHUB_OUTPUT"
    echo "deployed_${target_key}=true" >> "$GITHUB_OUTPUT"
  fi
}

echo "========================================"
echo "Google Apps Script Deployment"
echo "Target: $TARGET"
echo "========================================"
echo ""

if [ "$TARGET" = "gmail" ] || [ "$TARGET" = "both" ]; then
  deploy_to_target "$GMAIL_SCRIPT_ID" "Gmail Project" "gmail"
fi

if [ "$TARGET" = "126colby" ] || [ "$TARGET" = "both" ]; then
  deploy_to_target "$COLBY_SCRIPT_ID" "126Colby Project" "126colby"
fi

echo "========================================"
echo "All deployments completed successfully!"
echo "========================================"
