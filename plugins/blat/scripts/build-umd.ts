/**
 * Writes the UMD bundle `umdBuild.ts` describes, and its sourcemap: a stack
 * trace from a hosted plugin is otherwise one line of mangled names.
 *
 * Run: `pnpm --filter @jbrowse/plugin-blat build:umd`
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

import { umdBuildOptions, umdBundleProblems } from './umdBuild.ts'

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(
  pluginRoot,
  'dist/jbrowse-plugin-blat.umd.production.min.js',
)

mkdirSync(dirname(outfile), { recursive: true })

const result = await esbuild.build({
  ...umdBuildOptions(pluginRoot),
  outfile,
  sourcemap: true,
  logLevel: 'info',
})

console.log(`${outfile} (${(statSync(outfile).size / 1024).toFixed(1)} kb)`)

const problems = umdBundleProblems(
  Object.keys(result.metafile.inputs),
  readFileSync(outfile, 'utf8'),
)
if (problems.length > 0) {
  throw new Error(problems.join('\n'))
}
console.log('externals clean, defines JBrowsePluginBlat')
