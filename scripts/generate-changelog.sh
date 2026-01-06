#!/usr/bin/env bash

# Generate changelog from GitHub PRs merged since the last release
# Usage: scripts/generate-changelog.sh [tag]
# If no tag provided, uses the latest release tag

set -e

TAG=${1:-$(gh api repos/GMOD/jbrowse-components/releases/latest --jq '.tag_name')}
DATE=$(gh api repos/GMOD/jbrowse-components/releases/latest --jq '.published_at' | cut -d'T' -f1)

echo "## Changes since $TAG ($DATE)"
echo ""

# Get PRs, excluding dependabot
gh pr list --repo GMOD/jbrowse-components \
  --state merged \
  --base main \
  --search "merged:>$DATE" \
  --json number,title,author,labels \
  --jq '.[] | select(.author.login != "app/dependabot") | "- \(.title) (#\(.number)) @\(.author.login)"'
