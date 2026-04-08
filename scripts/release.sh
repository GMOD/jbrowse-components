#!/usr/bin/env bash

## Usage: scripts/release.sh <patch|minor|major>
# Bumps version, generates changelog, creates blog post, and publishes.

set -e
set -o pipefail

SEMVER_LEVEL="${1:-patch}"
[[ "$SEMVER_LEVEL" =~ ^(patch|minor|major)$ ]] || { echo "Invalid semver level '$SEMVER_LEVEL'. Use patch, minor, or major." && exit 1; }

trap 'rm -f tmp.json tmp_changelog.md' EXIT

# Pre-flight checks
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" != "main" ]] && { echo "Current branch is not main, please switch to main branch" && exit 1; }
git fetch origin main
MAINUPDATED=$(git rev-list --left-only --count origin/main...main)
[[ "$MAINUPDATED" != 0 ]] && { echo "main is not up to date with origin/main. Please pull and try again" && exit 1; }
LOCAL_CHANGES=$(git status --short)
[[ "$LOCAL_CHANGES" != "" ]] && { echo "Please discard or stash changes and try again." && exit 1; }

# Run checks
pnpm install
pnpm lint
pnpm test

# Calculate new version
PREVIOUS_VERSION=$(node --print "require('./plugins/alignments/package.json').version")
VERSION=$(node --print "const [maj,min,pat] = '$PREVIOUS_VERSION'.split('.').map(Number); '$SEMVER_LEVEL'==='major' ? (maj+1)+'.0.0' : '$SEMVER_LEVEL'==='minor' ? maj+'.'+(min+1)+'.0' : maj+'.'+min+'.'+(pat+1)")
RELEASE_TAG=v$VERSION

# Check for blog post draft
BLOGPOST_DRAFT=website/release_announcement_drafts/$RELEASE_TAG.md
[[ -f $BLOGPOST_DRAFT ]] || { echo "No blogpost draft found at $BLOGPOST_DRAFT, please write one." && exit 1; }

echo "Releasing $RELEASE_TAG (from $PREVIOUS_VERSION)"

# Update website config
RELEASE_TAG=$RELEASE_TAG node --print "const config = require('./website/docusaurus.config.json'); config.customFields.currentVersion = process.env.RELEASE_TAG; JSON.stringify(config,0,2)" >tmp.json
mv tmp.json website/docusaurus.config.json

# Generate changelog from GitHub PRs
echo "Generating changelog..."
CHANGELOG=$(scripts/generate-changelog.sh)
echo "$CHANGELOG" > tmp_changelog.md
echo "" >> tmp_changelog.md
cat CHANGELOG.md >> tmp_changelog.md
mv tmp_changelog.md CHANGELOG.md

# Generate blog post
NOTES=$(cat "$BLOGPOST_DRAFT")
DATETIME=$(date +"%Y-%m-%d %H:%M:%S")
DATE=$(date +"%Y-%m-%d")
BLOGPOST_FILENAME=website/blog/${DATE}-${RELEASE_TAG}-release.md
RELEASE_TAG=$RELEASE_TAG DATE=$DATETIME NOTES=$NOTES CHANGELOG=$CHANGELOG perl -p -e 's/\$\{([^}]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/eg' <scripts/blog_template.txt >"$BLOGPOST_FILENAME"

# Bump versions in all packages
node --eval "
const fs = require('fs');
const path = require('path');
const version = '$VERSION';
for (const ws of ['packages', 'products', 'plugins']) {
  const wsPath = path.join('.', ws);
  if (!fs.existsSync(wsPath)) continue;
  for (const dir of fs.readdirSync(wsPath)) {
    const pkgPath = path.join(wsPath, dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('  ' + pkg.name + ' -> ' + version);
  }
}
"

# Generate version.ts for packages that export it
for pkg in products/jbrowse-cli products/jbrowse-react-app products/jbrowse-react-circular-genome-view products/jbrowse-react-linear-genome-view; do
  echo "export const version = '$VERSION'" > $pkg/src/version.ts
done

# Commit, tag, push (publishing is handled by GitHub Actions)
pnpm format
git add .
git commit --message "$RELEASE_TAG"
git tag -a "$RELEASE_TAG" -m "$RELEASE_TAG"
git push && git push --tags

echo "✓ Released $RELEASE_TAG"
