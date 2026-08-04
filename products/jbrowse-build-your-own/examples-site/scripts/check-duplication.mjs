// Enforce this site's copy-pasteable rule from the other side:
//   node scripts/check-duplication.mjs
//
// Every example here is one complete file, so the same helper is written out in
// up to seven of them (see CLAUDE.md for why that is correct and why factoring
// them into a src/browser/ module would destroy the product). The cost of that
// rule is drift: a fix to the pan handler has to land in five files, and a file
// that gets missed is a page teaching a bug, with nothing to say so.
//
// So the rule gets a check. Two blocks with the same name in two example files
// must be character-identical once comments are stripped — comments are
// deliberately not compared, because a repeated block is supposed to carry a
// one-line pointer to the page that explains it rather than the whole reasoning.
//
// A block that genuinely differs per page goes in DIVERGES below, with the
// reason. That list is short on purpose: if it starts growing, the shared
// surface has outgrown copy-paste and the answer is a different *rule* argued in
// CLAUDE.md, not more entries here.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const examplesDir = path.join(root, 'src', 'examples')

// Names allowed to differ between files, and why. Anything not listed here is
// expected to be identical everywhere it appears.
const DIVERGES = {
  makeView:
    'each page declares its own tracks, start location and return shape',
  trackIds: "the page's own track list",
  featureTrack:
    'the feature-details page gives the genes track more height, being the only track on it',
  BrowserView:
    'pages with no session alias the view directly; the rest destructure it',
}

// Split a file into top-level declaration blocks. A block runs from its `const`
// / `function` / `type` line to the next one (or to `export default`), so any
// leading comment belongs to the block before it — which does not matter, since
// comments are stripped before comparison.
function blocks(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const starts = []
  lines.forEach((line, i) => {
    if (/^(?:export\s+)?(?:const|function|type)\s+[A-Za-z0-9_]+/.test(line)) {
      starts.push(i)
    }
    // `export default Foo` re-states a name that is already a block above it
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

// comments differ by design (each repeat points at the page that explains it),
// so compare code only
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
    byName.get(name).push({ file, code: code(lines) })
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
  // show the first difference rather than both blocks in full
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

console.log(
  `\n${shared} block(s) identical across files, ${drifted.length} drifted, ` +
    `${Object.keys(DIVERGES).length - unused.length} allowed to diverge`,
)
process.exit(drifted.length + unused.length ? 1 : 0)
