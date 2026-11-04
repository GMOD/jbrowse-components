// Two top-level blocks with the same name in two example files must match once
// comments are stripped, and a block copied into COPY_THRESHOLD files or more
// fails outright: it wants a helper in `@jbrowse/display-ui/embed`. See
// CLAUDE.md.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const examplesDir = path.join(here, '..', 'src', 'examples')

const COPY_THRESHOLD = 3

const DECLARATION =
  /^(?:export\s+)?(?:async\s+)?(?:const|let|function|class|interface|type)\s+([A-Za-z0-9_]+)/

function blocks(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const starts = []
  lines.forEach((line, i) => {
    const name = DECLARATION.exec(line)?.[1]
    if (name) {
      starts.push({ at: i, name })
    } else if (/^export default\s/.test(line)) {
      starts.push({ at: i })
    }
  })
  return starts.flatMap(({ at, name }, i) =>
    name ? [[name, lines.slice(at, starts[i + 1]?.at ?? lines.length)]] : [],
  )
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
    byName.set(name, [
      ...(byName.get(name) ?? []),
      { file, code: code(lines), lines: lines.length },
    ])
  }
}

const shared = [...byName].filter(([, entries]) => entries.length > 1)
const problems = []
for (const [name, entries] of shared) {
  const variants = Map.groupBy(entries, e => e.code)
  if (variants.size > 1) {
    const [a, b] = [...variants.keys()].map(text => text.split('\n'))
    const differs = a.findIndex((line, i) => line !== b[i])
    const at = differs === -1 ? a.length : differs
    problems.push(
      `DRIFT ${name} — ${variants.size} versions across example files:\n` +
        [...variants.values()]
          .map(group => `        ${group.map(e => e.file).join(', ')}`)
          .join('\n') +
        `\n      first difference at line ${at + 1} of the block:\n` +
        `        - ${a[at] ?? '(end of block)'}\n` +
        `        + ${b[at] ?? '(end of block)'}`,
    )
  }
  if (entries.length >= COPY_THRESHOLD) {
    problems.push(
      `COPIED ${name} — in ${entries.length} files: ` +
        `${entries.map(e => e.file).join(', ')}\n` +
        '      Publish it from @jbrowse/display-ui/embed with a jest test and ' +
        'import it, as a reader would. See CLAUDE.md.',
    )
  }
}

for (const problem of problems) {
  console.log(problem)
}
const blockCount = [...byName.values()].reduce((n, e) => n + e.length, 0)
console.log(
  `\n${blockCount} top-level block(s) across ${byName.size} name(s); ` +
    `${shared.length} name(s) in more than one file, ${problems.length} problem(s)`,
)
process.exit(problems.length ? 1 : 0)
