#!/bin/bash
set -e;
cd  $JB2TMP
for i in jbrowse-react*; do
  cd $i;
  yarn;
  yarn upgrade;
  cd -;
done;
cd -
