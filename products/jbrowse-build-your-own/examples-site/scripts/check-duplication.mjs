// Two top-level blocks with the same name in two example files must match once
// comments are stripped (DIVERGES lists the exceptions), and a block copied into
// COPY_THRESHOLD files or more needs a COPIED reason. See CLAUDE.md.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const examplesDir = path.join(root, 'src', 'examples')

const DIVERGES = {}

const COPY_THRESHOLD = 3

const COPIED = {}

function blocks(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const starts = []
  lines.forEach((line, i) => {
    if (/^(?:export\s+)?(?:const|function|type)\s+[A-Za-z0-9_]+/.test(line)) {
      starts.push(i)
    }
    if (/^export default\s/.test(line)) {
      starts.push({ end: i })
    }
  })
  const out = new Map()
  starts.forEach((start, i) => {
    if (typeof start !== 'number') {
      return
    }
    const next = starts[i + 1]
    const end = typeof next === 'number' ? next : (next?.end ?? lines.length)
    const name = /\s([A-Za-z0-9_]+)/.exec(
      lines[start].replace(/^(?:export\s+)?(?:const|function|type)/, ''),
    )?.[1]
    if (name) {
      out.set(name, lines.slice(start, end))
    }
  })
  return out
}

function code(lines) {
  return lines
    .filter(l => l.trim() && !/^\s*(?:\/\/|\/\*|\*)/.test(l))
    .join('\n')
    .trimEnd()
}

const byName = new Map()
for (const file of fs
  .readdirSync(examplesDir)
  .filter(f => f.endsWith('.tsx'))) {
  for (const [name, lines] of blocks(path.join(examplesDir, file))) {
    if (!byName.has(name)) {
      byName.set(name, [])
    }
    byName.get(name).push({ file, code: code(lines), lines: lines.length })
  }
}

const drifted = []
let shared = 0
for (const [name, entries] of byName) {
  if (entries.length < 2 || name in DIVERGES) {
    continue
  }
  const variants = new Map()
  for (const e of entries) {
    if (!variants.has(e.code)) {
      variants.set(e.code, [])
    }
    variants.get(e.code).push(e.file)
  }
  if (variants.size === 1) {
    shared++
    continue
  }
  drifted.push({ name, variants })
}

for (const { name, variants } of drifted) {
  console.log(`DRIFT ${name} — ${variants.size} versions across example files:`)
  const versions = [...variants.entries()]
  for (const [, files] of versions) {
    console.log(`        ${files.join(', ')}`)
  }
  const [a, b] = versions.map(([text]) => text.split('\n'))
  const at = a.findIndex((line, i) => line !== b[i])
  if (at >= 0) {
    console.log(`      first difference at line ${at + 1} of the block:`)
    console.log(`        - ${a[at] ?? '(end of block)'}`)
    console.log(`        + ${b[at] ?? '(end of block)'}`)
  }
}

const unused = Object.keys(DIVERGES).filter(n => !byName.has(n))
for (const name of unused) {
  console.log(`STALE DIVERGES entry "${name}" — no such block in any example`)
}

const unjustified = []
let redundantLines = 0
for (const [name, entries] of byName) {
  if (entries.length < 2) {
    continue
  }
  redundantLines += entries
    .slice(1)
    .reduce((total, entry) => total + entry.lines, 0)
  if (
    entries.length >= COPY_THRESHOLD &&
    !(name in COPIED) &&
    !(name in DIVERGES)
  ) {
    unjustified.push({ name, files: entries.map(e => e.file) })
  }
}

for (const { name, files } of unjustified) {
  console.log(
    `UNJUSTIFIED ${name} — copied into ${files.length} files with no COPIED entry:\n` +
      `        ${files.join(', ')}\n` +
      "      Either it is the reader's own to write (add it to COPIED with the\n" +
      '      reason) or JBrowse should publish it and the examples should import\n' +
      '      it like any reader would. See CLAUDE.md.',
  )
}

const staleCopied = Object.keys(COPIED).filter(
  n => (byName.get(n)?.length ?? 0) < COPY_THRESHOLD,
)
for (const name of staleCopied) {
  console.log(
    `STALE COPIED entry "${name}" — now in fewer than ${COPY_THRESHOLD} examples`,
  )
}

console.log(
  `\n${shared} block(s) identical across files, ${drifted.length} drifted, ` +
    `${Object.keys(DIVERGES).length - unused.length} allowed to diverge, ` +
    `${Object.keys(COPIED).length - staleCopied.length} justified as the reader's own\n` +
    `${redundantLines} redundant line(s) — copies beyond the first. Not a budget: ` +
    'adding a page adds copies, which is the rule working.',
)
process.exit(
  drifted.length + unused.length + unjustified.length + staleCopied.length
    ? 1
    : 0,
)
