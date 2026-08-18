import { execFile } from 'child_process'
import fs from 'fs'
import { promisify } from 'util'

import { oxfmtBin } from '../check-utils.ts'

// Generated pages are written raw and formatted in one `formatWithOxfmt` sweep
// at the end of the run (see generate.ts). Every path written here has to appear
// in that sweep or a page ships unformatted and `pnpm format` fights the next
// regen, so the sweep is fed from this list rather than from a hardcoded set of
// directories: the marker-block generators splice tables into hand-written
// guides anywhere under website/docs, and the package READMEs writeApiReadmes
// touches are outside website/docs entirely.
const written = new Set<string>()

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

export function writeDoc(file: string, content: string) {
  fs.writeFileSync(file, content)
  docText.set(file, content)
  written.add(file)
}

// Every path written this run, for the caller that formats them.
export function writtenDocs() {
  return [...written]
}

// Run the repo formatter over already-written files. Generated markdown is
// hand-authored prose (docstrings) reassembled by code, so its wrapping doesn't
// match what `pnpm format` produces; the marker-block generators additionally
// splice raw tables into the hand-written guides, which nothing else re-wraps.
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
