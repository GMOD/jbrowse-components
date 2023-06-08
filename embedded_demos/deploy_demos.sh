#!/bin/bash
for i in jbrowse-react*; do cd $i; yarn deploy; cd -; done;
