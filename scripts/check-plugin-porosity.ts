// Builds the exemplar plugin the way the plugin template builds a runtime
// plugin — esbuild, with every specifier `ReExports/list.ts` names mapped to a
// `JBrowseExports` read — and fails if the bundle carries a second copy of any
// workspace source.
//
//   pnpm check-plugin-porosity
//
// A specifier the list does not name is bundled, and a bundled `@jbrowse`
// module drags its relative closure with it: the built jbrowse-plugin-arg
// carried 84 files of @jbrowse/core (the util barrel, the blob map, a React
// context the host's provider never reaches) beside 29 of display-kit and 21 of
// render-core, for 100 KB of its own code. Nothing in the repo could see it,
// because component_tests/plugin-vite installs the same exemplar into a Vite
// app, where the bundler dedupes every copy. This is the check that sees it:
// the metafile's inputs, read for anything under packages/ or plugins/.
//
// Run from the repo root; the exemplar resolves its imports through the
// workspace links, so no build is needed first.
import path from 'node:path'

import esbuild from 'esbuild'

import reExportsList from '../packages/core/src/ReExports/list.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const ENTRY = path.join(ROOT, 'example-plugins/score-example/src/index.ts')

// What @fal-works/esbuild-plugin-global-externals does, in the one shape every
// published plugin's esbuild.mjs uses it in.
const globalExternals: esbuild.Plugin = {
  name: 'jbrowse-global-externals',
  setup(build) {
    const served = new Set(reExportsList)
    build.onResolve({ filter: /.*/ }, args =>
      served.has(args.path)
        ? { path: args.path, namespace: 'jbrowse-host' }
        : undefined,
    )
    build.onLoad({ filter: /.*/, namespace: 'jbrowse-host' }, args => ({
      contents: `module.exports = JBrowseExports[${JSON.stringify(args.path)}]`,
      loader: 'js',
    }))
  },
}

const result = await esbuild.build({
  entryPoints: [ENTRY],
  bundle: true,
  write: false,
  metafile: true,
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  logLevel: 'error',
  plugins: [globalExternals],
})

const workspaceSource = /^(packages|plugins)\//
const carried = Object.keys(result.metafile.inputs)
  .map(f => path.relative(ROOT, path.resolve(f)))
  .filter(f => workspaceSource.test(f))
  .sort()

if (carried.length > 0) {
  console.error(
    `the exemplar plugin bundles ${carried.length} workspace source file(s) a runtime plugin should read off the host — each is a subpath ReExports/list.ts does not name, or a module reached through one:\n${carried.map(f => `  ${f}`).join('\n')}`,
  )
  process.exit(1)
}
console.log(
  `score-example bundles no workspace source: ${Object.keys(result.metafile.inputs).length} inputs, all its own`,
)
