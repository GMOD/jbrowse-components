#!/usr/bin/env bash

## Usage scripts/release.sh <prerelease/patch/minor/major>
# The argument is a flag for the version bump level.
# If not provided, it will default to "patch".

## Precautionary bash tags
set -e
set -o pipefail

[[ -n "$1" ]] && SEMVER_LEVEL="$1" || SEMVER_LEVEL="patch"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" != "main" ]] && { echo "Current branch is not main, please switch to main branch" && exit 1; }
NPMUSER=$(pnpm whoami)
[[ -n "$NPMUSER" ]] || { echo "No NPM user detected, please run 'pnpm login'" && exit 1; }
MAINUPDATED=$(git rev-list --left-only --count origin/main...main)
[[ "$MAINUPDATED" != 0 ]] && { echo "main is not up to date with origin/main. Please fetch and try again" && exit 1; }
LOCAL_CHANGES=$(git status --short)
[[ "$LOCAL_CHANGES" != "" ]] && { echo "Please discard or stash changes and try again." && exit 1; }

# make sure packages are all up to date
pnpm install
pnpm lint
# make sure the tests are passing
pnpm test

# Get the version before release from a package.json
PREVIOUS_VERSION=$(node --print "require('./plugins/alignments/package.json').version")
# Use semver to get the new version from the semver level
VERSION=$(pnpm exec semver --increment "$SEMVER_LEVEL" "$PREVIOUS_VERSION")
RELEASE_TAG=v$VERSION

# make sure the blogpost draft is present
BLOGPOST_DRAFT=website/release_announcement_drafts/$RELEASE_TAG.md
[[ -f $BLOGPOST_DRAFT ]] || { echo "No blogpost draft found at $BLOGPOST_DRAFT, please write one." && exit 1; }

# Updates the "Browse demo instance" link on the homepage
RELEASE_TAG=$RELEASE_TAG node --print "const config = require('./website/docusaurus.config.json'); config.customFields.currentVersion = process.env.RELEASE_TAG; JSON.stringify(config,0,2)" >tmp.json
mv tmp.json website/docusaurus.config.json

# Blog post text
NOTES=$(cat "$BLOGPOST_DRAFT")
DATETIME=$(date +"%Y-%m-%d %H:%M:%S")
DATE=$(date +"%Y-%m-%d")
BLOGPOST_FILENAME=website/blog/${DATE}-${RELEASE_TAG}-release.md
RELEASE_TAG=$RELEASE_TAG DATE=$DATETIME NOTES=$NOTES perl -p -e 's/\$\{([^}]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/eg' <scripts/blog_template.txt >"$BLOGPOST_FILENAME"

# Bump versions in all packages
node --eval "
const fs = require('fs');
const path = require('path');
const version = '$VERSION';
const workspaces = ['packages', 'products', 'plugins'];
for (const ws of workspaces) {
  const wsPath = path.join('.', ws);
  if (!fs.existsSync(wsPath)) continue;
  for (const dir of fs.readdirSync(wsPath)) {
    const pkgPath = path.join(wsPath, dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}
console.log('Updated all packages to version ' + version);
"

pnpm format
git add .
git commit --message "Prepare for $RELEASE_TAG release"

# Publish all packages
pnpm publish -r --access public --no-git-checks

# Create git tag and push
git tag -a "$RELEASE_TAG" -m "$RELEASE_TAG"
git push && git push --tags
