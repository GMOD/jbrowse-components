import { execFile } from 'child_process'
import fs from 'fs'
import { promisify } from 'util'

import { check, formatMarkdown, oxfmtBin } from '../check-utils.ts'

// Every path written this run, whether spliced into a doc or written whole.
const written = new Set<string>()

// The subset written whole — the pages under the three directories generate.ts
// owns outright. They are the ones `pnpm format` skips (`ignorePatterns` in
// .oxfmtrc.json names the same three), so they are the ones the sweep below
// leaves alone. Tracked here rather than matched by directory at the sweep,
// because what makes a page exempt is that a run WROTE it whole.
const unformatted = new Set<string>()

// Every doc read this run. Each marker generator sweeps the whole doc tree for
// its own pair, so a `markers.ts` run read 17,640 files to see 588 distinct
// ones — 8.85MB re-read 30 times, 1.1-1.7s against 0.08-0.09s once cached.
//
// The cache lives here rather than beside the sweep because `writeDoc` is what
// has to invalidate it. A stale entry would be silent and total: a second
// generator splicing into the same doc writes the whole file back from what it
// read, and ARCHITECTURE.md carries four marker blocks, so the first
// generator's block would be dropped.
const docText = new Map<string, string>()

// A doc's current content, from the cache when this run already read or wrote
// it. Only for files a run may also write — a source file read through this
// would never be invalidated.
export function readDoc(file: string) {
  let text = docText.get(file)
  if (text === undefined) {
    text = fs.readFileSync(file, 'utf8')
    docText.set(file, text)
  }
  return text
}

// A splice into a file a person also edits: a marker block in a guide, an
// API_DOCS section in a README. Formatted at the end of the run, because the
// rest of the file is hand-written and stays under `pnpm check-format`.
//
// Under `--check` nothing reaches disk: the content goes into the cache, so a
// later splice into the same doc builds on it exactly as a write run would, and
// `staleDocs` compares the final text against what is committed.
export function writeDoc(file: string, content: string) {
  if (!check) {
    fs.writeFileSync(file, content)
  }
  docText.set(file, content)
  written.add(file)
}

export function writeUnformatted(file: string, content: string) {
  writeDoc(file, content)
  unformatted.add(file)
}

// A page this run owns outright. Not formatted, and not `pnpm format`'s to
// format either: nobody edits one by hand, and its prose is docstrings quoted
// verbatim, so rewrapping it to 80 columns only means a one-word source change
// reflows a whole paragraph on the page. Formatting all 263 written docs cost
// 4.2s and 47s of CPU a run; the ~15 that are spliced cost 1.3s of it.
//
// So the emitter owes what the formatter used to repair: `blankLinesAroundFences`
// is the one thing oxfmt did to these pages that was not wrapping.
export function writePage(file: string, content: string) {
  writeUnformatted(file, blankLinesAroundFences(content))
}

// A fenced block reads as its own paragraph, and the `#example` blocks quoted
// out of JSDoc routinely open one directly under the sentence introducing it.
// CommonMark lets a fence interrupt a paragraph, so this is not what makes them
// render — it is what keeps the committed page the shape every hand-written doc
// in the tree has. Only fences in column 0, so an indented one inside a list
// item is left alone, where a blank line would end the list.
export function blankLinesAroundFences(text: string) {
  const lines = text.split('\n')
  const out: string[] = []
  let open: string | undefined
  for (const [i, line] of lines.entries()) {
    const ticks = /^(`{3,})/.exec(line)?.[1]
    if (open === undefined && ticks !== undefined) {
      if (out.length > 0 && out[out.length - 1]!.trim() !== '') {
        out.push('')
      }
      open = ticks
      out.push(line)
    } else if (
      open !== undefined &&
      ticks !== undefined &&
      ticks.length >= open.length &&
      line.trim() === ticks
    ) {
      open = undefined
      out.push(line)
      const next = lines[i + 1]
      if (next !== undefined && next.trim() !== '') {
        out.push('')
      }
    } else {
      out.push(line)
    }
  }
  return out.join('\n')
}

// Every path written this run, for the caller that prunes what it didn't write.
export function writtenDocs() {
  return [...written]
}

// The written docs a person also owns, which is what the format sweep gets.
export function splicedDocs() {
  return [...written].filter(file => !unformatted.has(file))
}

function onDisk(file: string) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
}

// The docs whose committed bytes differ from what this run would have written.
// A spliced doc is compared after formatting, since that is what the write run
// commits, but only when the raw text already disagrees: raw text equal to a
// formatted file is formatted.
export function staleDocs() {
  return [...written].filter(file => {
    const content = docText.get(file)!
    const committed = onDisk(file)
    return (
      committed !== content &&
      (unformatted.has(file) ||
        committed === undefined ||
        formatMarkdown(content, file) !== committed)
    )
  })
}

// Run the repo formatter over the docs a run spliced into. Their marker blocks
// arrive as raw tables and prose callouts, and nothing else re-wraps them —
// while the rest of each file is hand-written, so leaving one unformatted puts
// `pnpm check-format` and the next hand edit at odds.
//
// oxfmt is the repo's formatter (`pnpm format`), so running it is what actually
// decides the committed bytes. This used to be prettier — per page as it was
// written, then over every doc again, re-run until it stopped changing anything.
// That cost ~12s a run to change nothing in the steady state, and left two
// formatters that had to agree on markdown forever or the `--check` gates would
// oscillate.
//
// `oxfmtBin` resolves the binary through node's resolver rather than by name;
// its comment says why, and the one-file-at-a-time counterpart lives beside it
// as `formatMarkdown`.
export async function formatWithOxfmt(paths: string[]) {
  await promisify(execFile)(process.execPath, [oxfmtBin(), ...paths])
}
