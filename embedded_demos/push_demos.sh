#!/bin/bash
set -e
cd $JB2TMP
for i in jbrowse-react*; do
  cd $i;
  echo `pwd`;
  git add yarn.lock;
  git commit -m "Update yarn.lock"
  git push;
  cd -;
done;
cd -
