/**
 * Why a jest suite loads what it loads. A suite's cost is the number of files
 * its graph reaches, so the question is which import drags a subtree in.
 *
 *   JEST_IMPORT_TRACE=/tmp/trace.jsonl npx jest <paths>
 *   node --experimental-strip-types scripts/importTrace.ts /tmp/trace.jsonl
 *       the repo imports that bring the most modules, across the traced suites
 *   ... importTrace.ts /tmp/trace.jsonl --why x-data-grid/index.js
 *       per suite, the chain of first imports that reached a matching module
 *
 * The trace is appended to, so remove the file between runs.
 */
import fs from 'node:fs'

interface Trace {
  test: string
  importedBy: [string, string][]
}

const [file, flag, pattern] = process.argv.slice(2)
if (!file) {
  console.error('usage: importTrace.ts <trace.jsonl> [--why <regex>]')
  process.exit(1)
}

const short = (p: string) =>
  p
    .replace(/.*node_modules\/\.pnpm\/[^/]+\/node_modules\//, 'npm:')
    .replace(/.*node_modules\//, 'npm:')
    .replace(`${process.cwd()}/`, '')

const traces = fs
  .readFileSync(file, 'utf8')
  .split('\n')
  .filter(line => line.length > 0)
  .map(line => JSON.parse(line) as Trace)

function subtreeSizes(importedBy: Map<string, string>) {
  const children = new Map<string, string[]>()
  for (const [child, parent] of importedBy) {
    children.set(parent, [...(children.get(parent) ?? []), child])
  }
  const sizes = new Map<string, number>()
  const sizeOf = (node: string): number => {
    const known = sizes.get(node)
    if (known === undefined) {
      sizes.set(node, 1)
      const size =
        1 + (children.get(node) ?? []).reduce((a, c) => a + sizeOf(c), 0)
      sizes.set(node, size)
      return size
    } else {
      return known
    }
  }
  for (const node of importedBy.keys()) {
    sizeOf(node)
  }
  return sizes
}

if (flag === '--why' && pattern) {
  const target = new RegExp(pattern)
  for (const { test, importedBy } of traces) {
    const parents = new Map(importedBy)
    const hit = [...parents.keys()].find(m => target.test(m))
    console.log(`${short(test)} (${parents.size} modules)`)
    if (hit) {
      const chain: string[] = []
      for (let at: string | undefined = hit; at; at = parents.get(at)) {
        chain.unshift(short(at))
      }
      for (const [i, m] of chain.entries()) {
        console.log(`${'  '.repeat(i + 1)}${m}`)
      }
    } else {
      console.log('  does not load it')
    }
  }
} else {
  const edges = new Map<string, { modules: number; suites: number }>()
  for (const { importedBy } of traces) {
    const parents = new Map(importedBy)
    const sizes = subtreeSizes(parents)
    for (const [child, parent] of parents) {
      const from = short(parent)
      if (!from.startsWith('npm:') && !/\.test\.|__mocks__/.test(from)) {
        const key = `${from} -> ${short(child)}`
        const e = edges.get(key) ?? { modules: 0, suites: 0 }
        e.modules += sizes.get(child) ?? 1
        e.suites += 1
        edges.set(key, e)
      }
    }
  }
  console.log(
    `${traces.length} suite(s); the repo imports bringing the most modules, as modules per suite x suites:`,
  )
  for (const [key, { modules, suites }] of [...edges.entries()]
    .sort((a, b) => b[1].modules - a[1].modules)
    .slice(0, 30)) {
    console.log(
      `${String(Math.round(modules / suites)).padStart(6)} x ${String(suites).padStart(4)}  ${key}`,
    )
  }
}
