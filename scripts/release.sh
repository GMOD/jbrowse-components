#!/bin/bash

## Usage scripts/release.sh blogpost.txt <prerelease/patch/minor/major>
# The first argument blogpost.txt is published to the jbrowse 2 blog. The
# second argument is a flag for the publishing command for version bump, by
# default it is none and will prompt

## Precautionary bash tags
set -e
set -u
set -o pipefail
set -x

NOTES=`cat $1`
DATE=$(date +"%Y-%m-%d")
BLOGPOST_FILENAME=products/website/blog/$(date +"%Y-%m-%d")-release.md
FRONTPAGE_FILENAME=products/website/src/pages/index.js

yarn run lerna-publish $2

## This pushes only the @jbrowse/web tag first because a flood of tags causes
## the CI system to skip the build
git push origin tag \"@jbrowse/web*\"

## Push the rest of the tags
git push --follow-tags

## Blogpost run after lerna publish, to get the accurate tags

JBROWSE_WEB_TAG=$(git tag --sort=creatordate -l "@jbrowse/web*"|head -n1)
JBROWSE_DESKTOP_TAG=$(git tag --sort=creatordate -l "@jbrowse/desktop*"|head -n1)
INSTANCE=https://s3.amazonaws.com/jbrowse.org/code/jb2/beta/$JBROWSE_WEB_TAG/index.html
JBROWSE_WEB_TAG=$JBROWSE_WEB_TAG JBROWSE_DESKTOP_TAG=$JBROWSE_DESKTOP_TAG DATE=$DATE NOTES=$NOTES perl -p -i -e 's/\$\{([^}]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/eg' < scripts/blog_template.txt > $BLOGPOST_FILENAME


INSTANCE=$INSTANCE node -p "const config = require('./products/website/docusaurus.config.json'); config.customFields.currentLink = process.env.INSTANCE; JSON.stringify(config,0,2)" > tmp.json
mv tmp.json products/website/docusaurus.config.json


git add .
git commit -m "[update docs] release"

