// dist/jbrowse-tables.js: the tables for a bare ECMAScript host, one file
// with no imports, as R's V8 sources it. Node built-ins resolve to empty
// modules, since only the host's readRange touches a file.
import { builtinModules } from 'node:module'
import path from 'node:path'

import { build } from 'esbuild'

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const names = new Set([
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
])

export async function buildBundle(outfile, minify = true) {
  const result = await build({
    entryPoints: [path.join(root, 'src/bundle.ts')],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['import', 'default'],
    target: 'es2022',
    minify,
    metafile: true,
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'node-builtins',
        setup(b) {
          b.onResolve({ filter: /.*/ }, args =>
            names.has(args.path)
              ? { path: args.path, namespace: 'empty' }
              : undefined,
          )
          b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({
            contents: 'module.exports = {}',
          }))
        },
      },
    ],
  })
  return Object.values(result.metafile.outputs)[0].bytes
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? path.join(root, 'dist/jbrowse-tables.js')
  const bytes = await buildBundle(out, process.env.MINIFY !== '0')
  process.stdout.write(
    `${path.relative(process.cwd(), out)} ${(bytes / 1e6).toFixed(2)} MB\n`,
  )
}
