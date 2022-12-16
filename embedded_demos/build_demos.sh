#!/bin/bash
for i in jbrowse*; do cd $i; yarn; yarn build; cd -; done;
