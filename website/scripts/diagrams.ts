// Renders website/diagrams/*.dot and *.svg and gates them against drift.
//
//   pnpm diagrams          render every source, then record what was rendered
//   pnpm diagrams:check    CI gate: no source is ahead of its figure
//
// The problem this exists for is specific to a figure whose SOURCE is tracked.
// Figure bytes are gitignored and live in the store (see figure-store.ts), so an
// unpushed regen is already invisible to git — website/CLAUDE.md says so. A
// diagram makes that sharper rather than softer: edit the source, forget to
// re-render, and the commit shows a source change while the site keeps serving
// the old picture. A reviewer reading that diff has every reason to believe the
// figure moved. Nothing else catches it, because figures.lock and the store stay
// perfectly consistent with each other the whole time — it is the source that
// is ahead of both.
//
// So diagrams.lock pairs each source with the figure it produced:
//
//   <source> <sha256 of the source> <sha256 of the .png it rendered to>
//
// and `check` fails when a source hash moves without its figure hash moving.
//
// Two things that look like alternatives and are not:
//
// Re-rendering in CI and diffing bytes would tie the gate to graphviz's own
// output stability. Measured, that is better than assumed: re-rendering the two
// architecture diagrams under 14.1.2 reproduced the bytes committed from another
// machine exactly, to the full sha256. But it is a property nobody promises
// and a version bump can retract silently, and paying for graphviz on the runner
// to learn it still holds is a worse trade than hashing the source, which asks a
// question with a stable answer by construction.
//
// A fifth field on the figures.lock line would put diagram bookkeeping on every
// figure in the store to serve the handful here, and rewrite the whole manifest
// to add it.
//
// `check` deliberately reads the FIGURES.LOCK hash rather than the PNG on disk:
// both are in git, it needs neither graphviz nor a `figures:pull`, and it runs
// in milliseconds on a bare checkout. What it is asking is "does the figure this
// commit publishes match the source this commit carries", and figures.lock is
// what the commit publishes.
//
// There is no --write that merely records the current state. That would let a
// stale diagram be laundered green by running the tool the failure message names
// — which is exactly what `pnpm autogen` is FOR everywhere else in this repo,
// and exactly wrong here. The only way to update diagrams.lock is to render, so
// the fix for the failure is the fix for the bug.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { isFile } from './check-utils.ts'
import { readManifest, repoRoot } from './figure-paths.ts'
import { figureName, hashBuffer } from './figure-store.ts'

const diagramsDir = join(repoRoot, 'website', 'diagrams')
const lockPath = join(diagramsDir, 'diagrams.lock')

// Two kinds of source, one pipeline. Graphviz is for a graph — a thing with
// nodes and edges whose placement is a layout problem worth handing to a solver.
// A schematic drawn along one axis (a genome, reads on it, an inverted block)
// has nothing for a solver to decide, and writing it as a digraph means fighting
// the layout to get coordinates you already knew; those are hand-authored SVG.
//
// Both go through the same lock and the same store, so the drift gate below does
// not care which is which, and a doc references `/img/<name>.png` either way.
const SOURCE_EXT = /\.(dot|svg)$/

// Repo-relative, because that is how figures.lock names things.
const figureFor = (source: string) =>
  `website/static/img/${source.replace(SOURCE_EXT, '.png')}`

// 150 keeps the text crisp at the width the docs render these at. Changing it
// changes every figure, so it lives here rather than in a README anyone can
// paste half of. rsvg-convert scales an SVG's px units by dpi/96, so the two
// renderers land on the same effective 1.5625x from the same number.
const DPI = '150'

// Render one source to PNG. Both tools are deterministic enough for the lock to
// mean something — see the note above about re-rendering in CI.
function renderSource(source: string, out: string) {
  if (source.endsWith('.svg')) {
    execFileSync(
      'rsvg-convert',
      ['--dpi-x', DPI, '--dpi-y', DPI, source, '-o', out],
      { cwd: diagramsDir },
    )
  } else {
    execFileSync('dot', ['-Tpng', `-Gdpi=${DPI}`, source, '-o', out], {
      cwd: diagramsDir,
    })
  }
}

const HEADER = `\
# Diagram sources and the figures they rendered to. Written by \`pnpm diagrams\`.
#
# The figure bytes are in the store (see figures.lock); this file is what ties
# them to the source that produced them, so a source edited without a re-render
# fails CI instead of quietly serving the old picture.
#
# <source> <sha256 of source> <sha256 of rendered figure>
`

interface Pair {
  source: string
  sourceSha: string
  figureSha: string
}

function listSources(): string[] {
  return readdirSync(diagramsDir)
    .filter(f => SOURCE_EXT.test(f))
    .sort()
}

function readLock(): Map<string, Pair> {
  const out = new Map<string, Pair>()
  let text
  try {
    text = readFileSync(lockPath, 'utf8')
  } catch {
    return out
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const [source, sourceSha, figureSha] = line.split(' ')
    if (!source || !sourceSha || !figureSha) {
      throw new Error(`malformed diagrams.lock line: ${raw}`)
    }
    out.set(source, { source, sourceSha, figureSha })
  }
  return out
}

function formatLock(pairs: Pair[]): string {
  const lines = pairs
    .map(p => `${p.source} ${p.sourceSha} ${p.figureSha}`)
    .sort()
  return `${HEADER}${lines.join('\n')}\n`
}

// A source whose hash still matches the lock, whose figure is on disk, is
// already rendered — so don't. Graphviz does not promise byte-stable output
// across versions, and re-rendering the whole corpus to pick up an edit to one
// source rewrites every figure hash in the lock and leaves ten figures for
// `figures:push` to publish, none of which anyone changed. Skipping is not
// laundering: an edited source, or a figure missing from this checkout, still
// renders.
function isCurrent(source: string, lock: Map<string, Pair>) {
  const recorded = lock.get(source)
  return (
    recorded?.sourceSha ===
      hashBuffer(readFileSync(join(diagramsDir, source))) &&
    isFile(join(repoRoot, figureFor(source)))
  )
}

function render() {
  const sources = listSources()
  if (!sources.length) {
    console.error(`no diagram sources in ${diagramsDir}`)
    process.exit(1)
  }
  const lock = readLock()
  const pairs: Pair[] = []
  let rendered = 0
  for (const source of sources) {
    const current = lock.get(source)
    if (current && isCurrent(source, lock)) {
      pairs.push(current)
      continue
    }
    rendered++
    const figure = figureFor(source)
    renderSource(source, join(repoRoot, figure))
    const sourceSha = hashBuffer(readFileSync(join(diagramsDir, source)))
    const figureSha = hashBuffer(readFileSync(join(repoRoot, figure)))
    pairs.push({ source, sourceSha, figureSha })
    console.log(`  ${source} -> ${figureName(figure)}`)
  }
  writeFileSync(lockPath, formatLock(pairs))
  console.log(
    rendered
      ? `rendered ${rendered} of ${pairs.length} website diagram(s)\n` +
          'Now `pnpm figures:push`, then commit diagrams.lock and figures.lock.'
      : `every website diagram was already current (${pairs.length})`,
  )
}

function check() {
  const sources = listSources()
  const lock = readLock()
  const figures = readManifest()
  const problems: string[] = []
  const rerender = '`pnpm diagrams`, then `pnpm figures:push`'

  for (const source of sources) {
    const recorded = lock.get(source)
    if (!recorded) {
      problems.push(`${source}: never rendered — run ${rerender}`)
      continue
    }
    const sourceSha = hashBuffer(readFileSync(join(diagramsDir, source)))
    if (sourceSha !== recorded.sourceSha) {
      problems.push(
        `${source}: edited since it was last rendered, so the site is still ` +
          `serving the old picture — run ${rerender}`,
      )
      continue
    }
    const figure = figures.get(figureFor(source))
    if (!figure) {
      // Rendered, recorded, and then the figure never reached the store — or
      // somebody deleted its line. Either way `pull` cannot install it.
      problems.push(
        `${source}: ${figureName(figureFor(source))} is not in figures.lock — run \`pnpm figures:push\``,
      )
    } else if (figure.sha256 !== recorded.figureSha) {
      // The figure moved without the source moving: a hand-edited PNG, or a
      // re-render on a different graphviz. Neither is wrong on its own, but the
      // pairing is now a guess, so re-render and let the tool state it.
      problems.push(
        `${source}: its figure changed but the source did not — run ${rerender}`,
      )
    }
  }

  for (const source of lock.keys()) {
    if (!sources.includes(source)) {
      problems.push(
        `${source}: in diagrams.lock but no longer in website/diagrams — run \`pnpm diagrams\``,
      )
    }
  }

  if (problems.length) {
    console.error(`${problems.length} problem(s):`)
    for (const p of problems) {
      console.error(`  ${p}`)
    }
    process.exit(1)
  }
  console.log(`${sources.length} diagram(s) match their sources`)
}

// ## The other corpus: agent-docs
//
// `agent-docs/**/diagrams/*.dot` renders to a committed SVG beside its source
// rather than to a figure in the store, because these docs are read as files —
// on GitHub, in an editor — and not served by any build. A `dot` fence in the
// markdown is a code block wherever the doc is opened, which is a diagram
// nobody sees.
//
// Committed output means the drift gate needs no lock file: the SVG carries the
// hash of the source it came from, so the artifact states its own provenance
// and `check` is a comparison between two files this commit already has. What
// that cannot see is a hand-edited SVG that keeps the stamp, which the website
// corpus's separate lock CAN see — the trade is one file fewer for one failure
// mode nobody has hit, and the render path is the only thing that writes a
// stamp.
const AGENT_DOCS = join(repoRoot, 'agent-docs')
const STAMP = 'diagram-source-sha256'

// Repo-relative paths of every `*.dot` under an `agent-docs/**/diagrams/` dir.
function agentSources(dir = AGENT_DOCS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return agentSources(path)
    }
    return entry.name.endsWith('.dot') && dir.endsWith('/diagrams')
      ? [relative(repoRoot, path)]
      : []
  })
}

const agentFigureFor = (source: string) => source.replace(/\.dot$/, '.svg')

// The markdown that could embed one. Every doc under agent-docs, so a diagram
// may be read by a doc in a sibling directory.
function agentDocFiles(dir = AGENT_DOCS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return agentDocFiles(path)
    }
    return entry.name.endsWith('.md') ? [path] : []
  })
}

// The stamp makes the same skip available here, with no lock to consult: an
// SVG carrying the current source's hash is already the picture this source
// renders to.
function agentIsCurrent(source: string) {
  try {
    const svg = readFileSync(join(repoRoot, agentFigureFor(source)), 'utf8')
    const stamped = new RegExp(`${STAMP} ([0-9a-f]+)`).exec(svg)?.[1]
    return stamped === hashBuffer(readFileSync(join(repoRoot, source)))
  } catch {
    return false
  }
}

function renderAgentDiagrams() {
  const sources = agentSources().filter(s => !agentIsCurrent(s))
  for (const source of sources) {
    const svg = execFileSync('dot', ['-Tsvg', join(repoRoot, source)], {
      encoding: 'utf8',
    })
    const sha = hashBuffer(readFileSync(join(repoRoot, source)))
    writeFileSync(
      join(repoRoot, agentFigureFor(source)),
      svg.replace('</svg>', `<!-- ${STAMP} ${sha} -->\n</svg>`),
    )
    console.log(`  ${source} -> ${agentFigureFor(source)}`)
  }
  return sources.length
}

function checkAgentDiagrams(): string[] {
  const problems: string[] = []
  const docs = agentDocFiles().map(f => readFileSync(f, 'utf8'))
  for (const source of agentSources()) {
    const figure = agentFigureFor(source)
    let svg
    try {
      svg = readFileSync(join(repoRoot, figure), 'utf8')
    } catch {
      problems.push(`${source}: never rendered — run \`pnpm diagrams\``)
      continue
    }
    const stamped = new RegExp(`${STAMP} ([0-9a-f]+)`).exec(svg)?.[1]
    const sha = hashBuffer(readFileSync(join(repoRoot, source)))
    if (stamped !== sha) {
      problems.push(
        `${source}: edited since it was last rendered, so the doc still shows ` +
          `the old picture — run \`pnpm diagrams\``,
      )
    }
    // A diagram no doc embeds is one whose last reader was deleted or renamed;
    // it renders, it passes, and nobody sees it. Same rule gen-diagram-usage
    // holds the website corpus to.
    const name = figure.slice(figure.lastIndexOf('/') + 1)
    if (!docs.some(text => text.includes(name))) {
      problems.push(`${source}: no agent-docs page embeds ${name}`)
    }
  }
  return problems
}

// A committed SVG whose source is gone is a picture nothing can regenerate.
function checkOrphanedFigures(): string[] {
  const rendered = new Set(agentSources().map(agentFigureFor))
  return agentDiagramFigures()
    .filter(f => !rendered.has(f))
    .map(f => `${f}: no .dot source — delete it, or restore the source`)
}

function agentDiagramFigures(dir = AGENT_DOCS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return agentDiagramFigures(path)
    }
    return entry.name.endsWith('.svg') && dir.endsWith('/diagrams')
      ? [relative(repoRoot, path)]
      : []
  })
}

if (process.argv.includes('--check')) {
  check()
  const problems = [...checkAgentDiagrams(), ...checkOrphanedFigures()]
  if (problems.length) {
    console.error(`${problems.length} agent-docs diagram problem(s):`)
    for (const p of problems) {
      console.error(`  ${p}`)
    }
    process.exit(1)
  }
  console.log(
    `${agentSources().length} agent-docs diagram(s) match their sources`,
  )
} else {
  render()
  const n = renderAgentDiagrams()
  console.log(
    n
      ? `rendered ${n} agent-docs diagram(s); commit the .svg beside each source.`
      : 'every agent-docs diagram was already current',
  )
}
