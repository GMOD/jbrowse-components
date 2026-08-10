import { join } from 'node:path'

import { websiteDir } from './paths.ts'

// The machine-readable record a sweep leaves behind, and where it leaves it.
//
// Split out of screenshot-report.ts, which writes it, for one reason: the
// READER is review-screenshots-web.ts, and screenshot-report.ts imports
// screenshot-options.ts — which parses process.argv at import time and exits on
// `--help`. So importing the shape of this file pulled the generator's whole
// CLI into a server that has its own, and `review-screenshots-web --help`
// printed `generate-screenshots`'s help and exited 0, with the review UI's own
// help unreachable and `--nosuchflag` failing inside a module nobody invoked.
// Everything here is a type and a path; nothing reads argv.
//
// The run's console output is printed and then lost, which is the wrong lifetime
// for half of it. A reviewer opening review-screenshots-web is looking at PNGs
// on disk with no way to tell which ones the last run failed to re-render, or
// which ones it re-rendered differently twice — and a figure that is stale
// because its spec died looks exactly like a figure that is fine.
//
// Gitignored: it describes one run on one machine, and committing it would churn
// on every sweep and mean nothing on anyone else's checkout.
//
// `filter` and `check` ride along because they decide what the record MEANS. A
// filtered run says nothing about the specs it skipped, and only a --check run
// can populate `flaky` at all — without both, a reviewer cannot tell "not
// flaky" from "never tested for flakiness".
//
// `selected` is the same argument taken to its conclusion. Everything else here
// is exceptions — a spec that rendered fine and unchanged leaves no trace at
// all, which is most of them — so "no entry" can only be read as "nothing went
// wrong" if something else says the run reached it. `filter` was standing in for
// that and got it wrong in the direction that matters: --affected and --cover
// narrow just as hard and leave `filter` empty, so a 14-spec --affected run (the
// workflow website/CLAUDE.md actually recommends) reported as a full sweep and
// the other 300 figures read as verified by it.
export interface RunReport {
  finishedAt: string
  filter: string[]
  check: boolean
  // every spec this run intended to render, however it was narrowed
  selected: string[]
  // how many specs existed at the time, so a reader can size `selected`
  // against the corpus rather than against today's spec list
  total: number
  // selected, then deliberately not rendered — the committed image is kept and
  // says nothing about the current app
  skipped: { name: string; reason: string }[]
  failures: { name: string; error: string }[]
  flaky: { name: string; frac: number }[]
  updated: { name: string; detail: string }[]
  suppressed: { name: string; frac: number }[]
}

export const runReportPath = join(websiteDir, 'scripts', 'screenshot-run.json')
