#!/bin/bash
# scripts/deploy-appscript.sh
# Dual-deployment script for Google Apps Script environments.

set -e

if ! command -v npx &> /dev/null
then
    echo "Error: npx could not be found. Please ensure Node.js is installed."
    exit 1
fi

GMAIL_SCRIPT_ID="${GMAIL_SCRIPT_ID}"
COLBY_SCRIPT_ID="${COLBY_SCRIPT_ID}"

if [ -z "$GMAIL_SCRIPT_ID" ] || [ -z "$COLBY_SCRIPT_ID" ]; then
  echo "Error: Both GMAIL_SCRIPT_ID and COLBY_SCRIPT_ID environment variables must be populated."
  exit 1
fi

deploy_to_target() {
  local script_id=$1
  local env_name=$2

  echo "Starting deployment to $env_name ($script_id)..."

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

  echo "Successfully deployed to $env_name ($script_id)"
  echo "---"
}

echo "========================================"
echo "Google Apps Script Dual Deployment"
echo "========================================"
echo ""

# Deploy to Gmail account
deploy_to_target "$GMAIL_SCRIPT_ID" "Gmail Account"

# Deploy to Colby workspace account
deploy_to_target "$COLBY_SCRIPT_ID" "126colby.com Workspace"

echo "========================================"
echo "All deployments completed successfully!"
echo "========================================"
