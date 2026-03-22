#!/bin/bash
# Build UMD bundle for parasitic deployment of jbrowse-plugin-rl-analytics.
# Uses esbuild to bundle, then post-processes for JBrowse runtime loading.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PLUGIN_DIR/dist"
ENTRY="$PLUGIN_DIR/src/index.ts"
BUNDLE="$DIST_DIR/bundle.mjs"
OUTPUT="$DIST_DIR/jbrowse-plugin-rl-analytics.umd.js"

mkdir -p "$DIST_DIR"

echo "Bundling with esbuild..."
npx esbuild "$ENTRY" \
  --bundle \
  --format=esm \
  --target=es2020 \
  --outfile="$BUNDLE" \
  --external:react \
  --external:react/jsx-runtime \
  --external:react-dom \
  --external:react-dom/client \
  --external:mobx \
  --external:mobx-react \
  --external:@jbrowse/mobx-state-tree \
  --external:mobx-state-tree \
  --external:@jbrowse/core/Plugin \
  --external:@jbrowse/core/pluggableElementTypes \
  --external:@jbrowse/core/configuration \
  --external:@jbrowse/core/util \
  --external:@jbrowse/core/util/types/mst \
  --external:@mui/material \
  --external:@mui/icons-material/Assessment \
  --external:@mui/icons-material/Explore \
  --external:@mui/icons-material/SaveAlt \
  --loader:.ts=ts \
  --loader:.tsx=tsx

echo "Post-processing for UMD..."
node -e "
const fs = require('fs');
let code = fs.readFileSync('$BUNDLE', 'utf-8');

// JBrowse calls installGlobalReExports(window) BEFORE loading UMD plugins,
// so window.JBrowseExports is available. We use it to resolve imports.
let varIdx = 0;

code = code.replace(/^import\\s+(.+?)\\s+from\\s+\"([^\"]+)\";?$/gm, (match, clause, mod) => {
  // Icons aren't in JBrowseExports - use null placeholders
  if (mod.startsWith('@mui/icons-material/')) {
    const name = clause.trim();
    return 'var ' + name + ' = null;';
  }

  const c = clause.trim();
  const vi = varIdx++;

  if (c.startsWith('* as ')) {
    const name = c.replace('* as ', '');
    return 'var ' + name + ' = __jbx(\"' + mod + '\");';
  } else if (c.startsWith('{')) {
    return 'var ' + c + ' = __jbx(\"' + mod + '\");';
  } else {
    return 'var __t' + vi + ' = __jbx(\"' + mod + '\"); var ' + c + ' = __t' + vi + '.default || __t' + vi + ';';
  }
});

// Remove export statements but keep the class
code = code.replace(/^export\\s*\\{[^}]*\\};?$/gm, '');
code = code.replace(/^export default /gm, 'var __rl_plugin_default = ');

// Wrap in IIFE with JBrowseExports accessor
const umd = ';(function() {\\n' +
  '// jbrowse-plugin-rl-analytics UMD bundle\\n' +
  '// JBrowseExports is set by installGlobalReExports() before plugin load\\n' +
  'var _g = typeof self !== \"undefined\" ? self : window;\\n' +
  'var _jbx = _g.JBrowseExports || {};\\n' +
  'function __jbx(mod) {\\n' +
  '  var m = _jbx[mod];\\n' +
  '  if (!m) console.warn(\"[rl-analytics] Module not found in JBrowseExports: \" + mod);\\n' +
  '  return m || {};\\n' +
  '}\\n\\n' +
  code + '\\n\\n' +
  'var Plugin = typeof __rl_plugin_default !== \"undefined\" ? __rl_plugin_default : null;\\n' +
  'if (!Plugin) { console.error(\"[rl-analytics] Plugin class not found\"); return; }\\n' +
  '_g.JBrowsePluginRLAnalyticsPlugin = { default: Plugin };\\n' +
  '})();\\n';

fs.writeFileSync('$OUTPUT', umd);
console.log('UMD bundle: $OUTPUT (' + (umd.length/1024).toFixed(1) + ' KB)');
"

rm -f "$BUNDLE"
echo "Done."
