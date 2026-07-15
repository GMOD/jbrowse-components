#!/usr/bin/env bash

# Generate changelog from GitHub PRs merged since the last release
# Usage: scripts/generate-changelog.sh [tag]
# If no tag provided, uses the latest release tag

set -e

TAG=${1:-$(gh api repos/GMOD/jbrowse-components/releases/latest --jq '.tag_name')}
# Full ISO 8601 timestamp (not just the date) so the merged:> boundary is exact.
# Truncating to a day made merged:>DATE strictly-after the whole day, dropping
# any PR merged later on the release day from both changelogs — lost forever.
PUBLISHED=$(gh api repos/GMOD/jbrowse-components/releases --jq ".[] | select(.tag_name == \"$TAG\") | .published_at")
DATE=${PUBLISHED%%T*}

echo "## Changes since $TAG ($DATE)"
echo ""

# Get PRs, excluding dependabot, grouped by first label. PRs with no label fall
# into an "Other" bucket rather than being dropped from the changelog entirely.
gh pr list --repo GMOD/jbrowse-components \
  --state merged \
  --base main \
  --limit 500 \
  --search "merged:>$PUBLISHED" \
  --json number,title,author,labels \
  --jq '
    [.[] | select(.author.login != "app/dependabot")]
    | group_by(.labels[0].name // "Other")
    | sort_by(.[0].labels[0].name // "Other")
    | .[] | "### \(.[0].labels[0].name // "Other")\n" + (map("- \(.title) ([#\(.number)](https://github.com/GMOD/jbrowse-components/pull/\(.number))) @\(.author.login)") | join("\n")) + "\n"
  '
