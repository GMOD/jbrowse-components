#!/usr/bin/env bash

# Generate changelog from GitHub PRs merged since the last release
# Usage: scripts/generate-changelog.sh [tag]
# If no tag provided, uses the latest release tag

set -e

TAG=${1:-$(gh api repos/GMOD/jbrowse-components/releases/latest --jq '.tag_name')}
DATE=$(gh api repos/GMOD/jbrowse-components/releases --jq ".[] | select(.tag_name == \"$TAG\") | .published_at" | cut -d'T' -f1)

echo "## Changes since $TAG ($DATE)"
echo ""

# Get PRs, excluding dependabot, grouped by first label
gh pr list --repo GMOD/jbrowse-components \
  --state merged \
  --base main \
  --limit 500 \
  --search "merged:>$DATE" \
  --json number,title,author,labels \
  --jq '
    [.[] | select(.author.login != "app/dependabot") | select(.labels | length > 0)]
    | group_by(.labels[0].name)
    | sort_by(.[0].labels[0].name)
    | .[] | "### \(.[0].labels[0].name)\n" + (map("- \(.title) (#\(.number)) @\(.author.login)") | join("\n")) + "\n"
  '
