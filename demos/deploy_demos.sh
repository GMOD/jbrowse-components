#!/bin/bash
for i in jbrowse*; do cd $i; yarn deploy; cd -; done;
