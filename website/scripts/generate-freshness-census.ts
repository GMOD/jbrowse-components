// Generates SVG_EXPORT.md's roster of who answers `dataCurrent` by comparing
// signatures, and what each pair of signatures is built from.
//
// The roster was prose and drifted the way a hand-written roster does:
// `isDataCurrent`'s own JSDoc said "the four displays that share it" while six
// called it, and SVG_EXPORT described HiC and LD comparing a viewport snapshot
// for weeks after they had stopped. check-doc-imports reaches neither — it
// resolves the identifiers a doc names, never the claims about how many, and
// `agent-docs/reference/` is outside its scope besides.
//
// **A caller is a call to `isDataCurrent`**, the rule itself rather than a name
// pattern, so a display joins by calling it and leaves by not.
import { readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import {
  checkOrWrite,
  isTsSource,
  markdownTableLines,
  spliceGeneratedBlock,
  walkFiles,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

const docPath = join(repoRoot, 'agent-docs', 'reference', 'SVG_EXPORT.md')

const SCAN_ROOTS = ['plugins', 'packages', 'products']

const SKIP_DIRS = new Set([
  'node_modules',
  'esm',
  'dist',
  'build',
  'shaders',
  '__pycache__',
])

// The declaration reads as a two-argument call to itself, so excluding it is
// load-bearing rather than tidiness.
const isCaller = (file: string) =>
  !file.endsWith('isDataCurrent.ts') && !/\.test\.tsx?$/.test(file)

// An argument can itself be a call (`currentRegionSignature(self)`), which a
// regex stopping at the first `)` truncates into something that reads like a
// typo in the published table.
function splitTopLevelArgs(text: string, open: number) {
  const args: string[] = []
  let depth = 0
  let start = open + 1
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') {
      depth++
    } else if (ch === ')') {
      if (depth === 0) {
        args.push(text.slice(start, i))
        return args.map(a => a.trim().replaceAll(/\s+/g, ' ')).filter(Boolean)
      }
      depth--
    } else if (ch === ',' && depth === 0) {
      args.push(text.slice(start, i))
      start = i + 1
    }
  }
  return undefined
}

interface Row {
  file: string
  loaded: string
  live: string
}

function callers() {
  const rows: Row[] = []
  const unreadable: string[] = []
  for (const root of SCAN_ROOTS) {
    for (const file of walkFiles(join(repoRoot, root), isTsSource, SKIP_DIRS)) {
      if (isCaller(file)) {
        const text = readFileSync(file, 'utf8')
        const path = relative(repoRoot, file).replaceAll(sep, '/')
        for (const m of text.matchAll(/\bisDataCurrent\(/g)) {
          const args = splitTopLevelArgs(text, m.index + m[0].length - 1)
          if (args?.length === 2) {
            rows.push({ file: path, loaded: args[0]!, live: args[1]! })
          } else {
            unreadable.push(path)
          }
        }
      }
    }
  }
  if (unreadable.length > 0) {
    throw new Error(
      `isDataCurrent called in a shape this generator cannot read, so the row ` +
        `would be missing rather than wrong: ${unreadable.join(', ')}`,
    )
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file))
}

function main() {
  const rows = callers()
  const packages = new Set(
    rows.map(r => r.file.split('/').slice(0, 2).join('/')),
  )

  const body = [
    '',
    `${rows.length} models across ${packages.size} packages answer \`dataCurrent\` ` +
      'by comparing the signature their data was loaded for against the one the ' +
      'live view calls for. A display joins by calling `isDataCurrent` and leaves ' +
      'by not calling it.',
    '',
    '<!-- prettier-ignore -->',
    ...markdownTableLines(
      ['Model', 'Loaded signature', 'Live signature'],
      rows.map(r => `| \`${r.file}\` | \`${r.loaded}\` | \`${r.live}\` |`),
    ),
  ]

  checkOrWrite({
    path: docPath,
    content: spliceGeneratedBlock({
      path: docPath,
      marker: 'FRESHNESS_SIGNATURE_CENSUS',
      body,
    }),
    label: 'freshness signature census',
    staleHint: 'freshness signature census',
  })
}

main()
