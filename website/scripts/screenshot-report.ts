import { writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

// What the run noticed while it was capturing, and how it says so at the end.
//
// The recording half and the printing half are one module on purpose: each
// report exists because something shipped wrong silently, and the observation
// that catches it is only useful if it reaches the summary. Splitting them would
// let a `record…` call be added with nowhere to surface.
//
// The reports are deliberately not failures. A figure that clipped its content,
// kept a stray tooltip, or captured a display that never painted is usually a
// number to adjust rather than a broken run — what it must not be is invisible.
import { PENDING_DISPLAYS } from '@jbrowse/browser-test-utils'

import { visibleTooltipText } from './annotations.ts'
import {
  repoRoot as figureRepoRoot,
  unpublishedFigures,
} from './figure-paths.ts'
import { figureName } from './figure-store.ts'
import { websiteDir } from './paths.ts'
import {
  CLIP_WARN_PX,
  DEVICE_SCALE_FACTOR,
  check,
  diffThreshold,
  filterTokens,
} from './screenshot-options.ts'
import { specs } from './screenshot-specs.ts'

import type { CommitResult } from './image-pipeline.ts'
import type { Page } from 'puppeteer'

// Which displays had still not reported their first paint when the frame was
// taken, for the end-of-run report.
//
// Every settle wait is best-effort — waitForDisplaysDone swallows its own
// timeout — so "all painted" and "we stopped waiting" leave the same trace:
// none. The result is a committed PNG with a blank track in it and a run that
// reported success. `PENDING_DISPLAYS` is exported for exactly this
// post-condition re-check, and both sibling harnesses (jbrowse-web's
// browser-tests and the desktop selenium harness) already do it; this is the
// only capture path that did not.
//
// Reported rather than fatal: a display that never paints is usually a spec
// whose settleMs is too short for its data, which is a number to raise, not a
// figure to fail. What it must not be is invisible.
export async function recordUnpainted(page: Page, name: string) {
  const pending = await page.evaluate(
    selector =>
      [...document.querySelectorAll<HTMLElement>(selector)].map(
        el => el.dataset.testid ?? '(unnamed display)',
      ),
    PENDING_DISPLAYS,
  )
  if (pending.length > 0) {
    unpaintedDisplays.set(
      name,
      [...new Set([...(unpaintedDisplays.get(name) ?? []), ...pending])].sort(),
    )
  }
}

// Note how much of the page this capture cut off, for the end-of-run report.
// Skipped for a `crop` spec, which frames deliberately.
export async function recordOverflow(page: Page, name: string) {
  clippedPx.set(
    name,
    Math.max(clippedPx.get(name) ?? 0, await overflowPx(page)),
  )
}

// CSS px of page laid out below the bottom of the viewport, i.e. content the
// capture cut off. The inverse of trailingBackgroundPx: too little viewport
// rather than too much. It cannot be recovered from the PNG — a clipped figure
// and one that happens to end flush with its last track look identical — so it
// has to be read from the live page, and a `crop` spec frames deliberately.
//
// Measured off the view containers, not `documentElement.scrollHeight`: the app
// fills the window and its overflow is absorbed by inner scroll containers, so
// the document itself never reports being taller than the viewport even when a
// track's rows are visibly cut in half.
async function overflowPx(page: Page) {
  return page.evaluate(() =>
    Math.max(
      0,
      ...Array.from(
        document.querySelectorAll('[data-testid^="view-container-"]'),
        el => el.getBoundingClientRect().bottom - window.innerHeight,
      ),
    ),
  )
}

const clippedPx = new Map<string, number>()
// spec name -> the tooltip text seen at any of that spec's captures. A staged
// spec shoots several frames under one name, so this accumulates the way
// unpaintedDisplays and clippedPx do rather than keeping only the last: a stray
// tooltip left on stage 1 is in the published figure whether or not stage 3
// still has it, and `expectTooltip` is satisfied by any frame showing one.
// Last-write-wins got both of those backwards, in the quiet direction: it
// reported nothing.
//
// An empty array is "this spec was shot and no frame had a tooltip", which is
// distinct from an absent key ("never shot"), and both readers below depend on
// the difference.
const tooltipSeen = new Map<string, string[]>()
// spec name -> displays that had not painted when its frame was taken
const unpaintedDisplays = new Map<string, string[]>()

// Note the tooltip on screen at capture, if any. Only called for a spec that
// did not ask for suppression — a tooltip is often what a figure is
// demonstrating, so the interesting cases are the one nobody asked for (a click
// sequence that ended on a hoverable control) and the one a tooltip figure lost.
export async function recordTooltip(page: Page, name: string) {
  const text = await visibleTooltipText(page)
  const seen = tooltipSeen.get(name) ?? []
  tooltipSeen.set(
    name,
    text !== undefined && !seen.includes(text) ? [...seen, text] : seen,
  )
}

// Specs that declare a tooltip belongs in their frame. Looked up by name rather
// than threaded through the capture, because a staged spec shoots several frames
// under one name and the declaration is the spec's.
const tooltipExpected = new Set(
  specs.filter(s => 'expectTooltip' in s && s.expectTooltip).map(s => s.name),
)

// Print a titled, ===-barred block of lines to stderr (failure/flaky summaries).
function printReport(title: string, lines: string[]) {
  const bar = '='.repeat(60)
  console.error(`\n${bar}`)
  console.error(title)
  console.error(bar)
  for (const line of lines) {
    console.error(line)
  }
  console.error(`\n${bar}`)
}

export interface RunTotals {
  passed: number
  failed: number
  kept: number
  // Every spec the run intended to render, after --filter/--affected/--cover
  // have all had their say. The only honest answer to "what did this run
  // cover" — see RunReport.selected.
  selected: string[]
  // Selected and then deliberately not rendered, with why. A count was enough
  // for the console line; the review UI needs the names, because a figure kept
  // because its spec is `curated` looks exactly like one the app still produces.
  skipped: { name: string; reason: string }[]
  failures: { name: string; error: string }[]
  flaky: { name: string; frac: number }[]
  changed: { name: string; result: CommitResult }[]
  // kept only because the spec raised its own diffThreshold above the run
  // default — the case where a real change hides behind a jitter allowance
  suppressed: { name: string; frac: number }[]
  slacked: { name: string; px: number }[]
}

export const pct = (n: number) => `${(n * 100).toFixed(3)}%`

export function printSummary(totals: RunTotals) {
  const { passed, failed, kept, skipped } = totals
  const { failures, flaky, changed, suppressed, slacked } = totals
  console.log(
    `\n${passed} ${check ? 'checked' : 'succeeded'}, ${failed} failed${
      check ? `, ${flaky.length} flaky` : `, ${kept} unchanged`
    }${skipped.length > 0 ? `, ${skipped.length} skipped (curated / heavy remote data / needs a GPU)` : ''}`,
  )
  if (changed.length > 0) {
    printReport(
      `UPDATED SCREENSHOTS (${changed.length})`,
      changed.map(({ name, result }) =>
        result.status === 'updated'
          ? `• ${name}.png (${result.detail})`
          : `• ${name}.png (new)`,
      ),
    )
  }
  if (suppressed.length > 0) {
    printReport(
      `KEPT BEHIND A RAISED diffThreshold (${suppressed.length}) — re-run these under --filter if you changed them on purpose`,
      suppressed.map(
        ({ name, frac }) =>
          `• ${name}.png: ${pct(frac)} differs, over the ${pct(diffThreshold)} default`,
      ),
    )
  }
  const clipped = [...clippedPx]
    .filter(([, px]) => px > CLIP_WARN_PX)
    .sort((a, b) => b[1] - a[1])
  if (clipped.length > 0) {
    printReport(
      `CONTENT CLIPPED BELOW THE FOLD (${clipped.length}) — the capture cut these off; raise the spec's viewportHeight by about this much`,
      clipped.map(
        ([name, px]) =>
          `• ${name}.png: ${px} css px of page below the viewport`,
      ),
    )
  }
  if (unpaintedDisplays.size > 0) {
    printReport(
      `DISPLAYS NOT PAINTED AT CAPTURE (${unpaintedDisplays.size}) — the settle gave up waiting, so these frames may show a blank track; raise the spec's settleMs, or fix the display that never reports done`,
      [...unpaintedDisplays].map(
        ([name, ids]) => `• ${name}.png: ${ids.join(', ')}`,
      ),
    )
  }
  const strayTooltips = [...tooltipSeen].filter(
    ([name, texts]) => texts.length > 0 && !tooltipExpected.has(name),
  )
  if (strayTooltips.length > 0) {
    printReport(
      `TOOLTIP LEFT IN THE CAPTURE (${strayTooltips.length}) — a hover the actions ended on; park the cursor or set hideTooltip, or set expectTooltip if the figure is about it`,
      strayTooltips.map(
        ([name, texts]) =>
          `• ${name}.png: ${texts.map(t => `"${t}"`).join(', ')}`,
      ),
    )
  }
  const missingTooltips = [...tooltipSeen].filter(
    ([name, texts]) => texts.length === 0 && tooltipExpected.has(name),
  )
  if (missingTooltips.length > 0) {
    printReport(
      `EXPECTED TOOLTIP MISSING (${missingTooltips.length}) — the spec sets expectTooltip but nothing was on screen`,
      missingTooltips.map(([name]) => `• ${name}.png`),
    )
  }
  if (slacked.length > 0) {
    printReport(
      `BLANK BELOW THE CONTENT, IN A FIGURE THAT JUST CHANGED (${slacked.length}) — if the app got shorter here, lower the spec's viewportHeight by about this much`,
      [...slacked]
        .sort((a, b) => b.px - a.px)
        .map(
          ({ name, px }) =>
            `• ${name}.png: ${Math.round(px / DEVICE_SCALE_FACTOR)} css px of blank below the last content`,
        ),
    )
  }
  if (flaky.length > 0) {
    printReport(
      `FLAKY SPECS (${flaky.length}) — nondeterministic renders`,
      flaky.map(
        ({ name, frac }) => `• ${name}: ${pct(frac)} drift between renders`,
      ),
    )
  }
  if (failures.length > 0) {
    printReport(
      `FAILURE SUMMARY (${failures.length})`,
      failures.map(
        ({ name, error }) => `\n• ${name}\n  ${error.replaceAll('\n', '\n  ')}`,
      ),
    )
  }
  printUnpublished(
    changed.flatMap(({ result }) =>
      result.status === 'kept' ? [] : result.path,
    ),
  )
  writeRunReport(totals)
}

// Everything above is printed and then lost, which is the wrong lifetime for
// half of it. A reviewer opening review-screenshots-web is looking at PNGs on
// disk with no way to tell which ones the last run failed to re-render, or
// which ones it re-rendered differently twice — and a figure that is stale
// because its spec died looks exactly like a figure that is fine.
//
// So the run leaves a machine-readable record beside its console output.
// Gitignored: it describes one run on one machine, and committing it would
// churn on every sweep and mean nothing on anyone else's checkout.
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

function writeRunReport(totals: RunTotals) {
  const report: RunReport = {
    finishedAt: new Date().toISOString(),
    filter: filterTokens,
    check,
    selected: totals.selected,
    total: specs.length,
    skipped: totals.skipped,
    failures: totals.failures,
    flaky: totals.flaky,
    updated: totals.changed.map(({ name, result }) => ({
      name,
      detail: result.status === 'updated' ? result.detail : 'new',
    })),
    suppressed: totals.suppressed,
  }
  try {
    writeFileSync(runReportPath, `${JSON.stringify(report, null, 2)}\n`)
  } catch (e) {
    // Never fail a 30-minute sweep over its own bookkeeping.
    console.error(`could not write ${runReportPath}: ${e}`)
  }
}

// Last, because it is the thing to act on.
//
// Figure bytes live in the S3 store, not in git, so a regen this run just wrote
// is invisible to `git status` — and if it is never pushed, every other machine
// and the published site keep serving the old image, with nothing anywhere
// saying so. CI cannot catch it either: the evidence is a file on this disk.
// This report is the replacement for the `M website/static/img/x.png` line that
// used to make it obvious.
//
// It reports the whole worktree, not just this run: the figure worth catching
// is usually one from an earlier run that never got published, and a --filter
// run should still say so. Saying "nothing outstanding" out loud matters as
// much as the warning — it is how a regen ends in a known state rather than an
// assumed one.
//
// The LIST is the whole worktree and the COMMAND is not, which is the one place
// those two have to disagree. A bare `pnpm figures:push` publishes everything in
// that list and rewrites figures.lock from all of it, so in a worktree several
// agents share, following this report's own advice sweeps somebody else's
// unpushed regen into your commit. That is not hypothetical — it is how this
// paragraph came to be written. So the report names what YOU are looking at and
// hands you a command scoped to what THIS run wrote.
//
// The tokens are figureNames of the paths the run actually committed, matched
// --exact. Spec names would be the obvious thing to print and are wrong: 27 of
// 349 of them are a substring of some other figure's name, so a printed
// `--filter dotplot` selects eleven figures this run never touched, which is the
// same over-publishing the flag exists to stop.
//
// --exact is safe for the mirrored pair despite `figureName` not being
// injective, and it is worth knowing WHY, because the surface reading says the
// opposite. products/jbrowse-img/img/x.png and website/static/img/jbrowse-img/x.png
// normalize to the SAME name, `jbrowse-img/x` — that is what the normalization
// is for — so one exact token selects both halves and they move together. The
// names are deduped because both halves being outstanding would otherwise print
// that one token twice.
function printUnpublished(writtenThisRun: string[]) {
  const outstanding = unpublishedFigures()
  if (outstanding.length === 0) {
    console.log('\nEvery figure on disk is published. Nothing to push.')
    return
  }
  const mine = new Set(
    writtenThisRun.map(p => relative(figureRepoRoot, p).replaceAll('\\', '/')),
  )
  const ours = [
    ...new Set(outstanding.filter(p => mine.has(p)).map(figureName)),
  ]
  printReport(
    `NOT IN THE FIGURE STORE (${outstanding.length}) — these exist only on this machine; push them and commit figures.lock, or they are silently dropped`,
    outstanding.map(
      p => `• ${figureName(p)}${mine.has(p) ? '  (this run)' : ''}`,
    ),
  )
  console.log(
    ours.length === 0
      ? 'None of them is from this run. Publish with `pnpm figures:push --filter <name>`,\n' +
          'or a bare `pnpm figures:push` if you mean to publish every figure above.'
      : `To publish what this run wrote and leave the rest alone:\n\n` +
          `  pnpm figures:push --exact --filter ${ours.join(',')}\n`,
  )
}
