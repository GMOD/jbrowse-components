#!/usr/bin/env bash

## Usage scripts/release.sh blogpost.md githubAuthToken <prerelease/patch/minor/major>
# The first argument blogpost.md is published to the jbrowse 2 blog. The second
# argument is a personal access token for the GitHub API with `public_repo`
# scope. You can generate a token at https://github.com/settings/tokens
# The third optional argument is a flag for the publishing command for version
# bump. If not provided, the publishing command will prompt you.

## Precautionary bash tags
set -e
set -o pipefail

# Blog post text
NOTES=$(cat "$1")
DATE=$(date +"%Y-%m-%d")
# Packages that have changed and will have their version bumped
CHANGED=$(yarn --silent lerna changed --all --json)

# Run lerna version first, publish after changelog and blog post have been created
yarn lerna version --no-push --message "[update docs] %s" "$3"

# Get the new version after versioning from lerna.json
VERSION=$(node --print "const lernaJson = require('./lerna.json'); lernaJson.version")
RELEASE_TAG=v$VERSION

# Updates the "Browse demo instance" link on the homepage
INSTANCE=https://s3.amazonaws.com/jbrowse.org/code/jb2/$RELEASE_TAG/index.html
INSTANCE=$INSTANCE node --print "const config = require('./website/docusaurus.config.json'); config.customFields.currentLink = process.env.INSTANCE; JSON.stringify(config,0,2)" >tmp.json
mv tmp.json website/docusaurus.config.json

# Generates a changelog with a section added listing the packages that were
# included in this release
CHANGELOG=$(GITHUB_AUTH="$2" node scripts/changelog.js "$CHANGED")
# Add the changelog to the top of CHANGELOG.md
echo "$CHANGELOG" >tmp.md
cat CHANGELOG.md >>tmp.md
mv tmp.md CHANGELOG.md

## Blogpost run after lerna version, to get the accurate tags
BLOGPOST_FILENAME=website/blog/${DATE}-${RELEASE_TAG}-release.md
RELEASE_TAG=$RELEASE_TAG DATE=$DATE NOTES=$NOTES CHANGELOG=$CHANGELOG perl -p -e 's/\$\{([^}]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/eg' <scripts/blog_template.txt >"$BLOGPOST_FILENAME"

git add .
git commit --amend --no-edit
yarn lerna publish from-git
git push --follow-tags
