#!/bin/bash
cat preamble.md
echo ""
echo "\`\`\`"
bin/run --help
echo "\`\`\`"
echo ""
echo ""
for i in create add-assembly add-track text-index admin-server upgrade make-pif sort-gff sort-bed add-connection add-track-json remove-track set-default-session; do
  echo "## jbrowse $i"

  echo ""
  echo "\`\`\`"
  bin/run $i --help
  echo "\`\`\`"
  echo ""
  echo ""
done
