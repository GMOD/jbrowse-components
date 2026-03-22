#!/usr/bin/env node
/**
 * Build a UMD bundle for parasitic deployment of jbrowse-plugin-rl-analytics.
 *
 * Uses esbuild to bundle all plugin source into a single IIFE file,
 * with JBrowse-provided dependencies accessed via pluginManager.jbrequire().
 *
 * Output: plugins/rl-analytics/dist/jbrowse-plugin-rl-analytics.umd.js
 */

import { build } from 'esbuild'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pluginRoot = resolve(__dirname, '..')
const distDir = resolve(pluginRoot, 'dist')

// These modules are provided by JBrowse at runtime via jbrequire
const jbrowseExternals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'mobx',
  'mobx-react',
  '@jbrowse/mobx-state-tree',
  'mobx-state-tree',
  '@jbrowse/core/Plugin',
  '@jbrowse/core/pluggableElementTypes',
  '@jbrowse/core/pluggableElementTypes/WidgetType',
  '@jbrowse/core/configuration',
  '@jbrowse/core/util',
  '@jbrowse/core/util/types/mst',
  '@mui/material',
  '@mui/icons-material',
  '@mui/icons-material/Assessment',
  '@mui/icons-material/Explore',
  '@mui/icons-material/SaveAlt',
]

async function main() {
  mkdirSync(distDir, { recursive: true })

  // Step 1: Bundle with esbuild, marking externals
  const result = await build({
    entryPoints: [resolve(pluginRoot, 'src/index.ts')],
    bundle: true,
    format: 'esm',
    write: false,
    target: 'es2020',
    external: jbrowseExternals,
    // Resolve .ts extensions
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
    },
    tsconfig: resolve(pluginRoot, 'tsconfig.build.esm.json'),
  })

  let code = result.outputFiles[0].text

  // Step 2: Replace ESM imports with jbrequire calls
  // Handle: import X from 'module'
  // Handle: import { X, Y } from 'module'
  // Handle: import * as X from 'module'
  // The esbuild output uses: import { ... } from "module";

  // First, collect all import statements and build a require map
  const importRegex = /^import\s+(.+?)\s+from\s+"([^"]+)";?$/gm
  const imports = []
  let match
  while ((match = importRegex.exec(code)) !== null) {
    imports.push({ full: match[0], clause: match[1], module: match[2] })
  }

  // Build the jbrequire header
  const requireLines = []
  const moduleVars = new Map() // module -> var name

  for (const imp of imports) {
    const mod = imp.module
    // Map @mui/icons-material/* to @mui/material SvgIcon (icons not in re-exports)
    if (mod.startsWith('@mui/icons-material/')) {
      // Icons aren't re-exported. We'll create simple placeholder components.
      continue
    }

    const varName = `__mod_${moduleVars.size}`
    moduleVars.set(mod, varName)

    // For @jbrowse/core/Plugin which exports a class directly
    if (mod === '@jbrowse/core/Plugin') {
      requireLines.push(`const ${varName} = __jbrequire("${mod}");`)
    } else {
      requireLines.push(`const ${varName} = __jbrequire("${mod}");`)
    }
  }

  // Replace imports with variable references
  for (const imp of imports) {
    const mod = imp.module
    if (mod.startsWith('@mui/icons-material/')) {
      // Replace icon imports with a simple null (icons are optional for UMD)
      const iconName = mod.split('/').pop()
      code = code.replace(imp.full, `const ${iconName}_default = null;`)
      continue
    }

    const varName = moduleVars.get(mod)
    const clause = imp.clause.trim()

    if (clause.startsWith('* as ')) {
      // import * as X from 'module' → const X = __mod_N
      const name = clause.replace('* as ', '')
      code = code.replace(imp.full, `const ${name} = ${varName};`)
    } else if (clause.startsWith('{')) {
      // import { X, Y } from 'module' → const { X, Y } = __mod_N
      code = code.replace(imp.full, `const ${clause} = ${varName};`)
    } else {
      // import X from 'module' → const X = __mod_N.default || __mod_N
      // Handle both default and namespace exports
      code = code.replace(imp.full, `const ${clause} = ${varName}.default || ${varName};`)
    }
  }

  // Remove any remaining export statements
  code = code.replace(/^export\s+\{[^}]*\};?$/gm, '')
  code = code.replace(/^export\s+default\s+/gm, 'const __default_export = ')
  // Handle: export { X as default }
  code = code.replace(/^export\s*\{[^}]*\}\s*;?$/gm, '')

  // Step 3: Wrap in IIFE with jbrequire
  const umd = `;(function() {
  // JBrowse Plugin: RL Analytics
  // Auto-generated UMD bundle for parasitic deployment

  var __jbrequire;

  ${requireLines.join('\n  ')}

  ${code}

  // Find the default export (the plugin class)
  var PluginClass = typeof __default_export !== 'undefined'
    ? __default_export
    : typeof RLAnalyticsPlugin !== 'undefined'
    ? RLAnalyticsPlugin
    : null;

  if (!PluginClass) {
    console.error('[rl-analytics] Could not find plugin class in bundle');
    return;
  }

  // Expose on global scope for JBrowse plugin loader
  ;(typeof self !== 'undefined' ? self : window).JBrowsePluginRLAnalyticsPlugin = {
    default: PluginClass,
  };
})();
`

  const outPath = resolve(distDir, 'jbrowse-plugin-rl-analytics.umd.js')
  writeFileSync(outPath, umd)
  console.log(`UMD bundle written to ${outPath}`)
  console.log(`Size: ${(umd.length / 1024).toFixed(1)} KB`)
}

main().catch(err => {
  console.error('Build failed:', err)
  process.exit(1)
})
