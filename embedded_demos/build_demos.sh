#!/bin/bash
set -e
JB2TMP=${JB2TMP:-~/jb2tmp}
cd $JB2TMP
for i in jbrowse*; do
  cd $i
  yarn
  yarn build
  cd -
done
cd -
