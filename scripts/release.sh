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

# Run lerna publish --no-push
yarn run lerna-publish "$3"

# Get the new after publishing from lerna.json
VERSION=$(node --print "const lernaJson = require('./lerna.json'); lernaJson.version")

# Get the latest JBrowse Web tag. If JBrowse Web was not in CHANGED, this tag
# will be from a previous version.
# Have to avoid overlap with @jbrowse/website
JBROWSE_WEB_TAG=$(git tag --sort=-creatordate --list "@jbrowse/web@*" | head --lines 1)

# If JBrowse Web was in the list of changed packages
if grep --quiet "@jbrowse/web" <<<"$CHANGED"; then
  ## This pushes only the @jbrowse/web tag first because a flood of tags causes
  ## the CI system to skip the build
  git push origin tag "@jbrowse/web*"
  echo "Waiting while the new jbrowse-web tag is processed on github actions before pushing the rest of the tags"
  sleep 30

  # Updates the "Browse demo instance" link on the homepage
  INSTANCE=https://s3.amazonaws.com/jbrowse.org/code/jb2/$JBROWSE_WEB_TAG/index.html
  INSTANCE=$INSTANCE node --print "const config = require('./website/docusaurus.config.json'); config.customFields.currentLink = process.env.INSTANCE; JSON.stringify(config,0,2)" >tmp.json
  mv tmp.json website/docusaurus.config.json
fi

# Generates a changelog with a section added listing the packages that were
# included in this release
CHANGELOG=$(GITHUB_AUTH="$2" node scripts/changelog.js "$VERSION" "$CHANGED")
# Add the changelog to the top of CHANGELOG.md
echo "$CHANGELOG" >tmp.md
cat CHANGELOG.md >>tmp.md
mv tmp.md CHANGELOG.md

## Blogpost run after lerna publish, to get the accurate tags
BLOGPOST_FILENAME=website/blog/${DATE}-${VERSION}-release.md
VERSION=$VERSION DATE=$DATE NOTES=$NOTES CHANGELOG=$CHANGELOG JBROWSE_WEB_TAG=$JBROWSE_WEB_TAG perl -p -e 's/\$\{([^}]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/eg' <scripts/blog_template.txt >"$BLOGPOST_FILENAME"

git add .
git commit --message "[update docs] release"
## Push the rest of the tags
git push --follow-tags
