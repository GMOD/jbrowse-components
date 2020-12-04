#!/usr/bin/env bash

## Usage scripts/release.sh blogpost.md githubAuthToken <prerelease/patch/minor/major>
# The first argument blogpost.md is published to the jbrowse 2 blog. The second
# argument is a personal access token for the GitHub API with `public_repo`
# scope. You can generate a token at https://github.com/settings/tokens
# The third optional argument is a flag for the publishing command for version
# bump. If not provided, it will default to "patch".

## Precautionary bash tags
set -e
set -o pipefail

[[ -n "$1" ]] || { echo "No blogpost file provided" && exit 1; }
[[ -n "$2" ]] || { echo "No GITHUB_AUTH token provided" && exit 1; }
[[ -n "$3" ]] && SEMVER_LEVEL="$3" || SEMVER_LEVEL="patch"

# Get the version before release from lerna.json
PREVIOUS_VERSION=$(node --print "const lernaJson = require('./lerna.json'); lernaJson.version")
# Use semver to get the new version from the semver level
VERSION=$(yarn --silent semver --increment "$SEMVER_LEVEL" "$PREVIOUS_VERSION")
RELEASE_TAG=v$VERSION

# Updates the "Browse demo instance" link on the homepage
INSTANCE=https://s3.amazonaws.com/jbrowse.org/code/jb2/$RELEASE_TAG/index.html
INSTANCE=$INSTANCE node --print "const config = require('./website/docusaurus.config.json'); config.customFields.currentLink = process.env.INSTANCE; JSON.stringify(config,0,2)" >tmp.json
mv tmp.json website/docusaurus.config.json

# Packages that have changed and will have their version bumped
CHANGED=$(yarn --silent lerna changed --all --json)
# Generates a changelog with a section added listing the packages that were
# included in this release
CHANGELOG=$(GITHUB_AUTH="$2" node scripts/changelog.js "$CHANGED" "$VERSION")
# Add the changelog to the top of CHANGELOG.md
echo "$CHANGELOG" >tmp.md
echo "" >tmp.md
cat CHANGELOG.md >>tmp.md
mv tmp.md CHANGELOG.md

# Blog post text
NOTES=$(cat "$1")
DATE=$(date +"%Y-%m-%d")
## Blogpost run after lerna version, to get the accurate tags
BLOGPOST_FILENAME=website/blog/${DATE}-${RELEASE_TAG}-release.md
RELEASE_TAG=$RELEASE_TAG DATE=$DATE NOTES=$NOTES CHANGELOG=$CHANGELOG perl -p -e 's/\$\{([^}]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/eg' <scripts/blog_template.txt >"$BLOGPOST_FILENAME"

git add .
git commit --message "Prepare for $RELEASE_TAG release"

# Run lerna version first, publish after changelog and blog post have been created
yarn lerna publish "$SEMVER_LEVEL" --message "[update docs] %s"
