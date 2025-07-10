#!/bin/bash
cat preamble.md
bin/run --help
echo "\n\n"
for i in create add-assembly add-track text-index admin-server upgrade make-pif sort-gff sort-bed add-connection add-track-json remove-track set-default-session; do
  echo "## jbrowse $i"
  bin/run $i --help
  echo "\n\n"
done
