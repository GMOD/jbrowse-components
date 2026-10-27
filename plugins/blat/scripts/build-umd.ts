/**
 * Bundles this plugin as a UMD script an external JBrowse can load at runtime,
 * the same way jbrowse-plugin-mafviewer and friends are loaded — a `plugins`
 * entry in a config, rather than a corePlugins import at build time. That is
 * what lets a hosted JBrowse (jb2hubs' hub configs, say) offer BLAT without
 * shipping it in the web bundle everyone downloads.
 *
 * Run: `pnpm --filter @jbrowse/plugin-blat build:umd`
 *
 * The contract with `PluginLoader`:
 * - the global is `JBrowsePlugin` + the config's plugin `name`, so a config
 *   entry of `{ name: 'Blat', url }` needs `globalName: 'JBrowsePluginBlat'`;
 * - that global's `.default` is the plugin class;
 * - anything JBrowse re-exports on `JBrowseExports` must NOT be bundled. Two
 *   copies of React or MST in one page is not a size problem, it is a broken
 *   page. Core's `hostShim` binds each such import to the host's copy, and
 *   fails the build on a name the host does not serve.
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hostShim } from '@jbrowse/core/ReExports/hostShim'
import * as esbuild from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const pluginRoot = join(here, '..')
const outfile = join(
  pluginRoot,
  'dist/jbrowse-plugin-blat.umd.production.min.js',
)

mkdirSync(dirname(outfile), { recursive: true })

const result = await esbuild.build({
  entryPoints: [join(pluginRoot, 'src/index.ts')],
  outfile,
  bundle: true,
  minify: true,
  // a stack trace from a hosted plugin is otherwise one line of mangled names,
  // and the other jbrowse.org-hosted plugins ship one alongside
  sourcemap: true,
  format: 'iife',
  globalName: 'JBrowsePluginBlat',
  platform: 'browser',
  target: 'es2020',
  // without this, bundled MUI code keeps its dev-only propType and warning
  // branches, which both bloat the bundle and log into a production console
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [hostShim({ pluginName: 'Blat' })],
  metafile: true,
  logLevel: 'info',
})

const bytes = statSync(outfile).size
console.log(`${outfile} (${(bytes / 1024).toFixed(1)} kb)`)

// The failure this build can actually make, and cannot see by eye: pulling a
// second copy of something whose IDENTITY the host relies on. React (one
// renderer, one hook dispatcher), MobX/MST (a second copy shares no reactivity
// and recognizes none of the host's types), @jbrowse/core, and
// @mui/material/styles (the theme travels by React context, so a duplicate
// provider renders unthemed).
//
// The four `@mui/icons-material` files are bundled, since the host serves no
// icons, and draw through the host's `createSvgIcon`, so they take its theme.
const HOST_OWNED =
  /node_modules\/(react|react-dom|mobx|mobx-react|mobx-state-tree)\/|@jbrowse\/mobx-state-tree\/|packages\/core\/src\//
const duplicated = Object.keys(result.metafile.inputs).filter(input =>
  HOST_OWNED.test(input),
)
if (duplicated.length > 0) {
  throw new Error(
    `bundled ${duplicated.length} module(s) the host already provides, which ` +
      `would run a second copy alongside JBrowse's:\n  ${duplicated.slice(0, 10).join('\n  ')}`,
  )
}

const bundle = readFileSync(outfile, 'utf8')

// the loader reads globalThis[`JBrowsePlugin${name}`], so the name in a config's
// plugins entry has to be `Blat` for this bundle to be findable at all
if (!bundle.startsWith('"use strict";var JBrowsePluginBlat=')) {
  throw new Error('bundle does not define the JBrowsePluginBlat global')
}

if (bundle.includes('window.JBrowseExports')) {
  throw new Error(
    'bundle reads window.JBrowseExports, which does not exist in the RPC worker',
  )
}
console.log(`externals clean, defines JBrowsePluginBlat`)
