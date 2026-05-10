#!/bin/bash
# scripts/deploy-appscript.sh

set -e

if ! command -v npx &> /dev/null; then
    echo "Error: npx could not be found. Please ensure Node.js is installed."
    exit 1
fi

GMAIL_SCRIPT_ID="${APPSCRIPT_PROJECT_ID_GMAIL}"
COLBY_SCRIPT_ID="${APPSCRIPT_PROJECT_ID_126COLBY}"
GMAIL_DEPLOY_ID="${PROD_DEPLOYMENT_ID_GMAIL}"
COLBY_DEPLOY_ID="${PROD_DEPLOYMENT_ID_126COLBY}"
TARGET="${TARGET_PROJECT:-both}"

if [ -z "$GMAIL_SCRIPT_ID" ] || [ -z "$COLBY_SCRIPT_ID" ]; then
  echo "Error: Project ID environment variables must be populated."
  exit 1
fi

deploy_to_target() {
  local script_id=$1
  local env_name=$2
  local target_key=$3
  local deployment_id=$4

  echo "----------------------------------------"
  echo "🚀 Starting deployment to $env_name..."

  # Write the .clasp.json configuration for this specific target
  echo "{\"scriptId\":\"$script_id\",\"rootDir\":\".\"}" > appscript/.clasp.json
  echo "✅ Generated .clasp.json for $env_name"

  # Navigate into the folder, push code, and return to root
  pushd appscript > /dev/null
  clasp push -f
  
  if [ -n "$deployment_id" ]; then
    echo "🔄 Redeploying to existing ID: $deployment_id (URL stays same)"
    clasp deploy -i "$deployment_id" -d "Automated Deploy $(date)"
  else
    echo "⚠️ No Deployment ID provided. Creating new version..."
    clasp version "Automated Deploy $(date)"
  fi
  popd > /dev/null

  echo "✅ Successfully deployed to $env_name"
  
  if [ -n "$GITHUB_OUTPUT" ]; then
    echo "url_${target_key}=https://script.google.com/d/${script_id}/edit" >> "$GITHUB_OUTPUT"
    echo "deployed_${target_key}=true" >> "$GITHUB_OUTPUT"
  fi
}

echo "========================================"
echo "Google Apps Script Deployment"
echo "Target: $TARGET"
echo "========================================"

if [ "$TARGET" = "gmail" ] || [ "$TARGET" = "both" ]; then
  deploy_to_target "$GMAIL_SCRIPT_ID" "Gmail Project" "gmail" "$GMAIL_DEPLOY_ID"
fi

if [ "$TARGET" = "126colby" ] || [ "$TARGET" = "both" ]; then
  deploy_to_target "$COLBY_SCRIPT_ID" "126Colby Project" "126colby" "$COLBY_DEPLOY_ID"
fi

echo ""
echo "========================================"
echo "All deployments completed successfully!"
echo "========================================"
