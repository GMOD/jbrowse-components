#!/bin/bash
set -e;
for i in jbrowse*; do
  cd $i;
  yarn;
  yarn build;
  cd -;
done;
