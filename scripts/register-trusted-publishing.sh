#!/usr/bin/env bash
# Registers npm trusted publishing for all public packages in this monorepo.
# Requires: npm >= 11.10.0, 2FA enabled on npmjs.com
# Run once - first package will prompt for 2FA, then you get a 5-minute window

set -euo pipefail

REPO="GMOD/jbrowse-components"
WORKFLOW_FILE="publish.yml"

node -e "
const fs = require('fs');
const path = require('path');
for (const ws of ['packages', 'products', 'plugins']) {
  if (!fs.existsSync(ws)) continue;
  for (const dir of fs.readdirSync(ws)) {
    const pkgPath = path.join(ws, dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg.name && pkg.private !== true) console.log(pkg.name);
  }
}
" | while read -r pkg; do
  if npm trust list "$pkg" --json 2>/dev/null | grep -q '"id"'; then
    echo "SKIP $pkg (already has trusted publisher)"
    continue
  fi
  echo "Registering: $pkg -> $REPO (.github/workflows/$WORKFLOW_FILE)"
  npm trust github "$pkg" --file "$WORKFLOW_FILE" --repo "$REPO" -y
  sleep 2
done

echo "Done!"
