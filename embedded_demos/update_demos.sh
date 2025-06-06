#!/bin/bash
set -e

JB2TMP=${JB2TMP:-~/jb2tmp}

cd $JB2TMP
for i in jbrowse-react*; do
  cd $i
  echo "UPDATE $i"
  git stash
  git pull
  yarn
  yarn upgrade
  echo "DONE UPDATE $i"
  cd -
done
cd -
