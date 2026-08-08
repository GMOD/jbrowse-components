#!/usr/bin/env bash

# Generate changelog from GitHub PRs merged since the last release
# Usage: scripts/generate-changelog.sh [tag]
# If no tag provided, uses the latest release tag
#
# stdout is the changelog, captured verbatim by release.ts — anything meant for
# the person running it goes to stderr.

set -euo pipefail

REPO=GMOD/jbrowse-components
LIMIT=500

TAG=${1:-$(gh api "repos/$REPO/releases/latest" --jq '.tag_name')}
if [[ -z $TAG ]]; then
  echo "error: no published release to generate a changelog against" >&2
  exit 1
fi

# Full ISO 8601 timestamp (not just the date) so the merged:> boundary is exact.
# Truncating to a day made merged:>DATE strictly-after the whole day, dropping
# any PR merged later on the release day from both changelogs — lost forever.
#
# Fetched by tag rather than by scanning `releases`, which is paginated: the
# scan silently found nothing once a release fell off page 1, leaving the
# boundary empty and the search unbounded.
PUBLISHED=$(gh api "repos/$REPO/releases/tags/$TAG" --jq '.published_at')
if [[ -z $PUBLISHED || $PUBLISHED == null ]]; then
  echo "error: release $TAG has no published_at (is it still a draft?)" >&2
  exit 1
fi
DATE=${PUBLISHED%%T*}

# Get PRs, excluding dependabot, grouped by first label. PRs with no label fall
# into an "Other" bucket rather than being dropped from the changelog entirely.
PRS=$(gh pr list --repo "$REPO" \
  --state merged \
  --base main \
  --limit "$LIMIT" \
  --search "merged:>$PUBLISHED" \
  --json number,title,author,labels)

# `--limit` truncates in silence, and the result still looks like a complete
# changelog. Say so rather than shipping a short one.
COUNT=$(jq 'length' <<<"$PRS")
if [[ $COUNT -ge $LIMIT ]]; then
  echo "warning: hit the $LIMIT PR limit; the changelog is truncated" >&2
fi

echo "## Changes since $TAG ($DATE)"
echo ""

jq -r '
    [.[] | select(.author.login != "app/dependabot")]
    | group_by(.labels[0].name // "Other")
    | sort_by(.[0].labels[0].name // "Other")
    | .[] | "### \(.[0].labels[0].name // "Other")\n" + (map("- \(.title) ([#\(.number)](https://github.com/GMOD/jbrowse-components/pull/\(.number))) @\(.author.login)") | join("\n")) + "\n"
  ' <<<"$PRS"
