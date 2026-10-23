// dist/jbrowse-tables.js: the tables for a bare ECMAScript host, one file
// with no imports, as R's V8 sources it. Node built-ins resolve to empty
// modules, since only the host's readRange touches a file.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'

import { build } from 'esbuild'

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..')
const names = new Set([
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
])

// Modules a bare host never runs, stubbed with one that throws on load: the
// feature details widget, which CorePlugin imports lazily and which brings MUI
// and the data grid, and the CRAM reader's worker source, so a host that has a
// `Worker` decodes in-process at once rather than after the pool's timeout.
const NEVER_RUN =
  /BaseFeatureWidget\/BaseFeatureDetail\/index\.tsx$|@gmod\/cram\/esm\/wasm\/cram-worker-source\.js$/

// R's V8 has no Unicode property tables, so jexl's identifier regexes
// (`\p{L}`, `\p{M}`) fail to compile and the bundle never loads. These
// ranges stand in for them: Latin, Greek, Cyrillic and the scripts above
// U+0370 count as letters, and the combining-mark blocks as marks.
const JEXL_LEXER = /@jbrowse\/jexl\/(?:esm|dist)\/Lexer\.js$/
const LETTERS =
  'A-Za-z\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u1FFF\\u2C00-\\uD7FF\\uF900-\\uFDFF\\uFE70-\\uFEFF'
const MARKS =
  '\\u0300-\\u036F\\u1AB0-\\u1AFF\\u1DC0-\\u1DFF\\u20D0-\\u20FF\\uFE20-\\uFE2F'

// A host reads the bundle as a text file. The CRAM reader inlines its
// htscodecs wasm as a binary string, and R on Windows failed to source the
// bundle with those raw control bytes in it, so every byte outside printable
// ASCII becomes an escape, which reads the same in a string, template or regex.
function printable(code) {
  return code.replaceAll(/[^\n\t\x20-\x7E]/g, c => {
    const n = c.charCodeAt(0)
    return n < 0x100
      ? `\\x${n.toString(16).padStart(2, '0')}`
      : `\\u${n.toString(16).padStart(4, '0')}`
  })
}

export async function buildBundle(outfile, minify = true) {
  const result = await build({
    entryPoints: [path.join(root, 'src/bundle.ts')],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    conditions: ['import', 'default'],
    target: 'es2020',
    minify,
    metafile: true,
    write: false,
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
          b.onLoad({ filter: JEXL_LEXER }, args => {
            const source = readFileSync(args.path, 'utf8')
            const contents = source
              .replaceAll('\\p{L}', LETTERS)
              .replaceAll('\\p{M}', MARKS)
            if (contents === source) {
              throw new Error(
                'jexl Lexer has no \\p{L} or \\p{M} to replace: drop the JEXL_LEXER rewrite',
              )
            }
            return { contents, loader: 'js' }
          })
          b.onLoad({ filter: NEVER_RUN }, () => ({
            contents: "throw new Error('a bare host never loads this module')",
            loader: 'js',
          }))
        },
      },
    ],
  })
  const code = printable(result.outputFiles[0].text)
  mkdirSync(path.dirname(outfile), { recursive: true })
  writeFileSync(outfile, code)
  return Buffer.byteLength(code)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] ?? path.join(root, 'dist/jbrowse-tables.js')
  const bytes = await buildBundle(out, process.env.MINIFY !== '0')
  process.stdout.write(
    `${path.relative(process.cwd(), out)} ${(bytes / 1e6).toFixed(2)} MB\n`,
  )
}
