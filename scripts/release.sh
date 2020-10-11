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

# yarn run lerna-publish $2

## Blogpost run after lerna publish, to get the accurate tags
JBROWSE_WEB_TAG=$(git tag --sort=-creatordate -l "@gmod/jbrowse-web*"|head -n1)
JBROWSE_DESKTOP_TAG=$(git tag --sort=-creatordate -l "jbrowse-desktop*"|head -n1)
DATE=$DATE NOTES=$NOTES perl -p -i -e 's/\$\{([^}]+)\}/defined $ENV{$1} ? $ENV{$1} : $&/eg' < scripts/blog_template.txt > $BLOGPOST_FILENAME
# git add $BLOGPOST_FILENAME
# git commit -m "[update docs] release"

