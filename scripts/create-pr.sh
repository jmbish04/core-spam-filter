#!/bin/bash
# scripts/create-pr.sh
# Usage: ./scripts/create-pr.sh <branch-name> "<commit-message>"

set -e

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <branch-name> \"<commit-message>\""
  echo "Example: $0 feat/new-feature \"feat: add new feature\""
  exit 1
fi

BRANCH_NAME=$1
shift
COMMIT_MESSAGE="$*"

# Ensure gh cli is installed
if ! command -v gh &> /dev/null; then
    echo "Error: gh (GitHub CLI) could not be found. Please install it or use the web interface."
    exit 1
fi

echo "🚀 Starting PR creation process..."

# Check if there are changes to commit
if git diff-index --quiet HEAD --; then
  echo "⚠️ No changes detected to commit."
else
  # Checkout new branch
  git checkout -b "$BRANCH_NAME"

  # Add all changes
  git add .

  # Commit changes
  git commit -m "$COMMIT_MESSAGE"
fi

# Push to origin
echo "⬆️ Pushing branch to origin..."
git push -u origin "$BRANCH_NAME"

# Create PR
echo "📝 Creating Pull Request..."
gh pr create --title "$COMMIT_MESSAGE" --body "Automated PR created via scripts/create-pr.sh"

echo "✅ PR successfully created!"
