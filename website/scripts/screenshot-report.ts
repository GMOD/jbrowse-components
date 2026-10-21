// What the run noticed while it was capturing, and how it says so at the end.
// Recording and printing share a module so every `record…` reaches the summary.
// The reports are not failures: a clipped or tooltip-stained frame is usually
// a number to adjust, and must only be visible.
import { writeFileSync } from 'node:fs'
import { relative } from 'node:path'

import { PENDING_DISPLAYS } from '@jbrowse/browser-test-utils'

import {
  repoRoot as figureRepoRoot,
  unpublishedFigures,
} from './figure-paths.ts'
import { figureName, figureNames } from './figure-store.ts'
import {
  CLIP_WARN_PX,
  DEVICE_SCALE_FACTOR,
  check,
  diffThreshold,
  filterTokens,
} from './screenshot-options.ts'
import { type RunReport, runReportPath } from './screenshot-run-report.ts'
import { specs } from './screenshot-specs.ts'
import { visibleTooltipText } from './tooltips.ts'

import type { CommitResult } from './image-pipeline.ts'
import type { Page } from 'puppeteer'

// Displays still reporting no paint when the frame was taken, for the
// end-of-run report. The frame gate fails a spec over one unless the spec sets
// `allowUnsettled`, so what lands here opted out of that gate, or went unpainted
// after it — either way a frame that may show a blank track, and one that must
// not pass unnoticed.
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

// CSS px of view below the bottom of the viewport, which the PNG alone cannot
// tell from a figure ending flush with its last track. Measured off the view
// containers, since the app's inner scrollers keep the document itself from
// ever reporting overflow.
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
// spec name -> the tooltip texts seen across all of its frames, since a staged
// spec's stray tooltip on any stage is in the published figure. An empty array
// is "shot, no tooltip", distinct from an absent key, "never shot".
const tooltipSeen = new Map<string, string[]>()
// spec name -> displays that had not painted when its frame was taken
const unpaintedDisplays = new Map<string, string[]>()

// Called for a spec that did not set tooltip: 'hide', to report a tooltip
// nobody asked for and one a tooltip figure lost.
export async function recordTooltip(page: Page, name: string) {
  const text = await visibleTooltipText(page)
  const seen = tooltipSeen.get(name) ?? []
  tooltipSeen.set(
    name,
    text !== undefined && !seen.includes(text) ? [...seen, text] : seen,
  )
}

// Specs that declare a tooltip belongs in their frame.
const tooltipExpected = new Set(
  specs.filter(s => 'tooltip' in s && s.tooltip === 'expect').map(s => s.name),
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
  // every spec the run set out to render; see RunReport.selected
  selected: string[]
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
  const { passed, failed, kept } = totals
  const { failures, flaky, changed, suppressed, slacked } = totals
  console.log(
    `\n${passed} ${check ? 'checked' : 'succeeded'}, ${failed} failed${
      check ? `, ${flaky.length} flaky` : `, ${kept} unchanged`
    }`,
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
      `DISPLAYS NOT PAINTED AT CAPTURE (${unpaintedDisplays.size}) — these frames may show a blank track; fix the display that never reports done, or drop the spec's allowUnsettled so the run fails on it`,
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
      `TOOLTIP LEFT IN THE CAPTURE (${strayTooltips.length}) — a hover the actions ended on; park the cursor or set tooltip: 'hide', or tooltip: 'expect' if the figure is about it`,
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
      `EXPECTED TOOLTIP MISSING (${missingTooltips.length}) — the spec sets tooltip: 'expect' but nothing was on screen`,
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

// The machine-readable record of the run. Its shape lives in
// screenshot-run-report.ts, which its reader can import without parsing argv.
function writeRunReport(totals: RunTotals) {
  const report: RunReport = {
    finishedAt: new Date().toISOString(),
    filter: filterTokens,
    check,
    selected: totals.selected,
    total: specs.length,
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

// Last, because it is the thing to act on. Figure bytes live in the S3 store,
// so an unpushed regen shows nowhere in git. The list covers the whole
// worktree; the suggested command covers only what this run wrote, as exact
// figure names, so following it never publishes another agent's regen.
// A mirrored jbrowse-img pair shares one name and moves as one.
function printUnpublished(writtenThisRun: string[]) {
  const outstanding = unpublishedFigures()
  if (outstanding.length === 0) {
    console.log('\nEvery figure on disk is published. Nothing to push.')
    return
  }
  const mine = new Set(
    writtenThisRun.map(p => relative(figureRepoRoot, p).replaceAll('\\', '/')),
  )
  const outstandingNames = figureNames(outstanding)
  const mineNames = new Set(
    outstanding.filter(p => mine.has(p)).map(figureName),
  )
  const ours = outstandingNames.filter(name => mineNames.has(name))
  printReport(
    `NOT IN THE FIGURE STORE (${outstandingNames.length}) — these exist only on this machine; push them and commit figures.lock, or they are silently dropped`,
    outstandingNames.map(
      name => `• ${name}${mineNames.has(name) ? '  (this run)' : ''}`,
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
