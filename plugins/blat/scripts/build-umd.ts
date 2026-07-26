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
 * - anything JBrowse re-exports on `window.JBrowseExports` must NOT be bundled.
 *   Two copies of React or MST in one page is not a size problem, it is a
 *   broken page, which is why the external list is read from core's own
 *   `ReExports/list.ts` rather than hand-maintained here. That file exists for
 *   exactly this purpose and stays in sync with the runtime by a check in
 *   modules.tsx.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

import reExports from '../../../packages/core/src/ReExports/list.ts'

import type { Plugin } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const pluginRoot = join(here, '..')
const outfile = join(
  pluginRoot,
  'dist/jbrowse-plugin-blat.umd.production.min.js',
)

const provided = new Set(reExports)

// `@mui/icons-material/*` is deliberately absent from the re-export list, so the
// four icons this plugin uses do get bundled. They are small, and they import
// SvgIcon from @mui/material, which is external — so the host's MUI still draws
// them.
const jbrowseGlobals: Plugin = {
  name: 'jbrowse-globals',
  setup(build) {
    build.onResolve({ filter: /.*/ }, args =>
      provided.has(args.path)
        ? { path: args.path, namespace: 'jbrowse-global' }
        : undefined,
    )
    build.onLoad({ filter: /.*/, namespace: 'jbrowse-global' }, args => ({
      // CJS on purpose: the named exports of each module are not knowable at
      // build time, and this lets esbuild's interop resolve them at runtime
      contents: `module.exports = window.JBrowseExports[${JSON.stringify(args.path)}]`,
      loader: 'js',
    }))
  },
}

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
  plugins: [jbrowseGlobals],
  metafile: true,
  logLevel: 'info',
})

const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0
console.log(`${outfile} (${(bytes / 1024).toFixed(1)} kb)`)

// The failure this build can actually make, and cannot see by eye: pulling a
// second copy of React, MobX, MST or @jbrowse/core into the page. That is not a
// size problem, it is a broken plugin — two MobX instances do not share
// reactivity, two MSTs do not recognize each other's types. It happens when a
// module resolves by a path the re-export list does not name (a deep import, a
// transitive dep), so the check is on what actually landed in the bundle rather
// than on what we meant to externalize.
//
// @mui/icons-material is expected here: it is deliberately not re-exported, and
// its icons render through the host's SvgIcon.
const HOST_OWNED =
  /node_modules\/(react|react-dom|mobx|mobx-react|mobx-state-tree)\/|node_modules\/@mui\/material\/|@jbrowse\/mobx-state-tree\/|packages\/core\/src\//
const duplicated = Object.keys(result.metafile.inputs).filter(input =>
  HOST_OWNED.test(input),
)
if (duplicated.length > 0) {
  throw new Error(
    `bundled ${duplicated.length} module(s) the host already provides, which ` +
      `would run a second copy alongside JBrowse's:\n  ${duplicated.slice(0, 10).join('\n  ')}`,
  )
}

// the loader reads globalThis[`JBrowsePlugin${name}`], so the name in a config's
// plugins entry has to be `Blat` for this bundle to be findable at all
if (
  !readFileSync(outfile, 'utf8').startsWith(
    '"use strict";var JBrowsePluginBlat=',
  )
) {
  throw new Error('bundle does not define the JBrowsePluginBlat global')
}
console.log(`externals clean, defines JBrowsePluginBlat`)
