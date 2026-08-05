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
  CLIP_WARN_PX,
  DEVICE_SCALE_FACTOR,
  SLACK_WARN_PX,
  check,
  diffThreshold,
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
// spec name -> the tooltip text on screen at capture, or undefined for none.
// Only populated for specs that did not ask for suppression.
const tooltipSeen = new Map<string, string | undefined>()
// spec name -> displays that had not painted when its frame was taken
const unpaintedDisplays = new Map<string, string[]>()

// Note the tooltip on screen at capture, if any. Only called for a spec that
// did not ask for suppression — a tooltip is often what a figure is
// demonstrating, so the interesting cases are the one nobody asked for (a click
// sequence that ended on a hoverable control) and the one a tooltip figure lost.
export async function recordTooltip(page: Page, name: string) {
  tooltipSeen.set(name, await visibleTooltipText(page))
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
  skipped: number
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
    }${skipped > 0 ? `, ${skipped} skipped (curated / heavy remote data / needs a GPU)` : ''}`,
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
    ([name, text]) => text !== undefined && !tooltipExpected.has(name),
  )
  if (strayTooltips.length > 0) {
    printReport(
      `TOOLTIP LEFT IN THE CAPTURE (${strayTooltips.length}) — a hover the actions ended on; park the cursor or set hideTooltip, or set expectTooltip if the figure is about it`,
      strayTooltips.map(([name, text]) => `• ${name}.png: "${text}"`),
    )
  }
  const missingTooltips = [...tooltipSeen].filter(
    ([name, text]) => text === undefined && tooltipExpected.has(name),
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
}
