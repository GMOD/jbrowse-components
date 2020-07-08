#!/bin/bash

# read the sidebar.json file to get the files for pandoc in order
for i in $(node read_sidebar.js); do
  # trim off the header of the docusaurus md files
  tail -n +5 $i;
done | pandoc title.md - --toc -o jbrowse.pdf
