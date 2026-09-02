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

// Names the host lists but cannot actually satisfy for our use. `SvgIcon` is
// re-exported as a lazy React COMPONENT (MuiReExports.ts: `lazy(() =>
// import(...))`), not as the module — so the `createSvgIcon` that every
// @mui/icons-material file imports from that specifier is undefined there. Left
// external, the bundle throws `createSvgIcon is not a function` while loading,
// the global is never defined, and PluginLoader fails the whole session. Caught
// by loading this bundle in the released hosted build; the module list alone
// says the name is provided, which is true and not enough.
const NOT_ACTUALLY_PROVIDED = new Set(['@mui/material/SvgIcon'])

// Read the MST fork under its upstream name. `modules.ts` maps BOTH
// '@jbrowse/mobx-state-tree' and 'mobx-state-tree' to the same namespace object,
// so on any v4 host this is the identical module — but only the upstream name
// exists on v3 and older, where the fork's name resolves to undefined and the
// widget's `types.model(...)` throws during install, taking the session with it.
// Same remap jb2plugins' esbuild configs do (jbrowse-plugin-gwas/esbuild.mjs).
const READ_AS: Record<string, string> = {
  '@jbrowse/mobx-state-tree': 'mobx-state-tree',
}

const provided = new Set(
  reExports.filter(name => !NOT_ACTUALLY_PROVIDED.has(name)),
)

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
      // build time, and this lets esbuild's interop resolve them at runtime.
      // globalThis, not window: the host loads every runtime plugin into its
      // RPC worker too, where `window` is a ReferenceError at importScripts.
      contents: `module.exports = globalThis.JBrowseExports[${JSON.stringify(READ_AS[args.path] ?? args.path)}]`,
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
// second copy of something whose IDENTITY the host relies on. React (one
// renderer, one hook dispatcher), MobX/MST (a second copy shares no reactivity
// and recognizes none of the host's types), @jbrowse/core, and
// @mui/material/styles (the theme travels by React context, so a duplicate
// provider renders unthemed).
//
// MUI is deliberately NOT on that list, including its styles internals. Pulling
// in one icon drags them along, because MUI's own files import each other by
// relative path — which no list of bare specifiers can externalize. The shipped
// jbrowse-plugin-msaview bundle carries the same duplication, so this is the
// ecosystem's normal shape rather than a fault of this build; the cost is bundle
// size and icons falling back to MUI's default theme, not a broken page.
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
