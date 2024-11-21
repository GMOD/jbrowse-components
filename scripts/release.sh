#!/usr/bin/env bash

## Usage scripts/release.sh githubAuthToken <prerelease/patch/minor/major>
# The first argument is a personal access token for the GitHub API with `public_repo`
# scope. You can generate a token at https://github.com/settings/tokens
# The second optional argument is a flag for the publishing command for version
# bump. If not provided, it will default to "patch".

## Precautionary bash tags
set -e
set -o pipefail

[[ -n "$1" ]] || { echo "No GITHUB_AUTH token provided" && exit 1; }
GITHUB_AUTH=$1
[[ -n "$2" ]] && SEMVER_LEVEL="$2" || SEMVER_LEVEL="patch"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" != "main" ]] && { echo "Current branch is not main, please switch to main branch" && exit 1; }
NPMUSER=$(npm whoami)
[[ -n "$NPMUSER" ]] || { echo "No NPM user detected, please run 'npm adduser'" && exit 1; }
MAINUPDATED=$(git rev-list --left-only --count origin/main...main)
[[ "$MAINUPDATED" != 0 ]] && { echo "main is not up to date with origin/main. Please fetch and try again" && exit 1; }
LOCAL_CHANGES=$(git status --short)
[[ "$LOCAL_CHANGES" != "" ]] && { echo "Please discard or stash changes and try again." && exit 1; }

# make sure packages are all up to date
yarn
yarn lint
# make sure the tests are passing
yarn test

# Get the version before release from lerna.json
PREVIOUS_VERSION=$(node --print "const lernaJson = require('./lerna.json'); lernaJson.version")
# Use semver to get the new version from the semver level
VERSION=$(yarn --silent semver --increment "$SEMVER_LEVEL" "$PREVIOUS_VERSION")
RELEASE_TAG=v$VERSION

# make sure the blogpost draft is present
BLOGPOST_DRAFT=website/release_announcement_drafts/$RELEASE_TAG.md
[[ -f $BLOGPOST_DRAFT ]] || { echo "No blogpost draft found at $BLOGPOST_DRAFT, please write one." && exit 1; }

# Updates the "Browse demo instance" link on the homepage
RELEASE_TAG=$RELEASE_TAG node --print "const config = require('./website/docusaurus.config.json'); config.customFields.currentVersion = process.env.RELEASE_TAG; JSON.stringify(config,0,2)" >tmp.json
mv tmp.json website/docusaurus.config.json

# Generates a changelog with a section added listing the packages that were
# included in this release
CHANGELOG=$(GITHUB_AUTH="$GITHUB_AUTH" yarn changelog --silent --next-version "$VERSION")
# Add the changelog to the top of CHANGELOG.md
echo "$CHANGELOG" >tmp.md
echo "" >>tmp.md
cat CHANGELOG.md >>tmp.md
mv tmp.md CHANGELOG.md

# Blog post text
NOTES=$(cat "$BLOGPOST_DRAFT")
DATETIME=$(date +"%Y-%m-%d %H:%M:%S")
DATE=$(date +"%Y-%m-%d")
## Blogpost run after lerna version, to get the accurate tags
BLOGPOST_FILENAME=website/blog/${DATE}-${RELEASE_TAG}-release.md
RELEASE_TAG=$RELEASE_TAG DATE=$DATETIME NOTES=$NOTES CHANGELOG=$CHANGELOG perl -p -e 's/\$\{([^}]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/eg' <scripts/blog_template.txt >"$BLOGPOST_FILENAME"

yarn format
git add .
git commit --message "Prepare for $RELEASE_TAG release"

# Run lerna version first, publish after changelog and blog post have been created
yarn lerna publish --force-publish "*" "$SEMVER_LEVEL" --message "[update docs] %s"

# Push bump version from embedded package.json lifecycles, might be good if this was part of lerna but is separate for now
git push
