#!/bin/bash
set -e;
cd  $JB2TMP
for i in jbrowse*; do
  cd $i;
  yarn;
  yarn build;
  cd -;
done;
cd -
