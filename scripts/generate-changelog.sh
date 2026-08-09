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

# The boundary is when $TAG was CUT — the date of the commit it names — not
# when its GitHub release was published.
#
# Those are not the same moment. A tag push starts the desktop builds, and the
# release stays a draft until a human clicks publish once the binaries land:
# ~20 minutes on each of the last two releases, and unbounded in principle. The
# previous changelog was generated at *tag* time, so keying this one off
# published_at left the window between them covered by neither — a PR merged in
# it was lost from every changelog. Consecutive tag times abut exactly.
#
# It is also the only boundary that exists while a release is still a draft:
# published_at is null there, which used to be a hard error.
#
# Full ISO 8601 timestamp (not just the date) so the merged:> boundary is exact.
# Truncating to a day made merged:>DATE strictly-after the whole day, dropping
# any PR merged later on the release day from both changelogs — lost forever.
# Forced to UTC because GitHub search compares instants and the committer's
# offset is whatever machine cut the release.
CUT=$(TZ=UTC git log -1 --format=%cd --date=format-local:'%Y-%m-%dT%H:%M:%SZ' \
  "$TAG^{commit}" 2>/dev/null) || CUT=''
if [[ -z $CUT ]]; then
  echo "error: tag $TAG is not in this checkout; run 'git fetch --tags'" >&2
  exit 1
fi
DATE=${CUT%%T*}

# Get PRs, excluding dependabot, grouped by first label. PRs with no label fall
# into an "Other" bucket rather than being dropped from the changelog entirely.
PRS=$(gh pr list --repo "$REPO" \
  --state merged \
  --base main \
  --limit "$LIMIT" \
  --search "merged:>$CUT" \
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
