#!/bin/bash
JB2TMP=${JB2TMP:-~/jb2tmp}

cd $JB2TMP
for i in jbrowse-react*; do
  cd $i
  echo "PUSH $i"
  git add yarn.lock
  git commit -m "Update yarn.lock"
  git push
  echo "DONE PUSH $i"
  cd -
done
cd -
