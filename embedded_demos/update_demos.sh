#!/bin/bash
for i in jbrowse*; do cd $i; yarn upgrade; cd -; done;

