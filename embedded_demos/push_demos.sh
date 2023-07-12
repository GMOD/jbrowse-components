#!/bin/bash
set -e
cd $JB2TMP
for i in jbrowse-react*; do
  cd $i;
  git add yarn.lock;
  git push;
  cd -;
done;
cd -
