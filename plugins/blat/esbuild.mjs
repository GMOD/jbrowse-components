// Builds a runtime-loadable UMD bundle of the BLAT plugin for jbrowse-web
// (which does NOT bundle @jbrowse/plugin-blat in corePlugins — desktop does).
// Mirrors jb2plugins/jbrowse-plugin-mafviewer/esbuild.mjs but consumes this
// plugin's own src/, keeping the monorepo as the single source of truth. The
// jb2hubs site references the published artifact via enhanceConfig's
// BLAT_PLUGIN_URL. Requires devDeps esbuild + @fal-works/esbuild-plugin-global-externals.
//
//   NODE_ENV=production node esbuild.mjs
//
import fs from 'node:fs'

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals'
import JBrowseReExports from '@jbrowse/core/ReExports/list'
import * as esbuild from 'esbuild'

const isWatch = process.argv.includes('--watch')

// Plugins reuse the React/MUI/mobx/core instances JBrowse already loaded via
// window.JBrowseExports; bundling a second copy causes duplicate-React errors.
function createGlobalMap(jbrowseGlobals) {
  const globalMap = {}
  for (const global of jbrowseGlobals) {
    globalMap[global] = {
      varName: `JBrowseExports["${global}"]`,
      type: 'cjs',
    }
  }
  globalMap['@jbrowse/mobx-state-tree'] = {
    varName: `JBrowseExports["mobx-state-tree"]`,
    type: 'cjs',
  }
  return globalMap
}

const config = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  // JBrowse's PluginLoader reads globalThis.JBrowsePlugin<name>.default; the
  // config-level plugin name is 'Blat', so this global must be JBrowsePluginBlat.
  globalName: 'JBrowsePluginBlat',
  metafile: true,
  plugins: [globalExternals(createGlobalMap(JBrowseReExports))],
  ...(isWatch
    ? { outfile: 'dist/out.js' }
    : {
        outfile: 'dist/jbrowse-plugin-blat.umd.production.min.js',
        sourcemap: true,
        minify: true,
      }),
}

if (isWatch) {
  const ctx = await esbuild.context(config)
  await ctx.watch()
  console.log('Watching files...')
} else {
  const result = await esbuild.build(config)
  fs.writeFileSync('meta.json', JSON.stringify(result.metafile))
  for (const [file, meta] of Object.entries(result.metafile.outputs)) {
    console.log(`Wrote ${meta.bytes} bytes to ${file}`)
  }
}
