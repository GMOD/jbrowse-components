#!/bin/bash
# Regenerates README.md from the CLI's own --help output. Run on prepack; the
# result is mirrored into website/docs/cli.md by website/scripts/generate-cli-doc.ts.
#
# The command list is read out of `--help` rather than written here. src/index.ts
# keeps one registry so a command can't be wired into dispatch but missed in the
# help listing; a hardcoded list in this script would have reintroduced exactly
# that split one level down, and did — `validate` shipped documented nowhere.
set -euo pipefail

commands=$(node dist/bin.js --help | sed -n '/^COMMANDS$/,/^$/p' | sed -n 's/^  \([a-z][a-z0-9-]*\) .*/\1/p')

if [ -z "$commands" ]; then
  echo "generate_readme.sh: no commands parsed from 'node dist/bin.js --help'" >&2
  exit 1
fi

cat preamble.md
echo ""
echo "\`\`\`"
node dist/bin.js --help
echo "\`\`\`"
echo ""
echo ""
for i in $commands; do
  echo "## jbrowse $i"

  echo ""
  echo "\`\`\`"
  node dist/bin.js "$i" --help
  echo "\`\`\`"
  echo ""
  echo ""
done
