#!/bin/bash
set -e
JB2TMP=${JB2TMP:-~/jb2tmp}
cd $JB2TMP
for i in jbrowse-react*; do
  cd $i
  echo "DEPLOY $i"
  yarn deploy
  echo "DONE DEPLOY $i"
  cd -
done
cd -
