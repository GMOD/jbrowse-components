// What a filming run noticed, and how it says so at the end.
//
// The screenshots' counterpart is screenshot-report.ts, and this is the same
// arrangement for the same reason: recording and printing are one module, so a
// `record…` call cannot be added with nowhere to surface.
//
// A tour goes wrong more quietly than a figure does. Nothing diffs a clip, so
// the frame that cut the graph in half, the display that never painted and the
// step that took twenty seconds all leave a file that plays. The run is the only
// place any of it is visible, and until this module the run said one line per
// tour and left the reader to notice.
import { PENDING_DISPLAYS } from '@jbrowse/browser-test-utils'

import type { Page } from 'puppeteer'

// How much taller than the app the frame may be before the clip is mostly page
// background. Generous, because a tour that ends on a menu closing wants room
// the end state does not use.
const SLACK_WARN_PX = 120

export interface ContentHeights {
  // the app's own height at the first frame, the last, and its tallest between
  first: number
  last: number
  tallest: number
}

export interface FilmedTour {
  name: string
  frame: { width: number; height: number }
  content: ContentHeights
  seconds: number
  mp4Bytes: number
  posterBytes: number
  // displays still unpainted when the camera stopped
  unpainted: string[]
  // steps that took long enough to be worth a `cut`, as [say-or-selector, ms]
  slowSteps: [string, number][]
}

const filmed: FilmedTour[] = []

export function recordFilmed(tour: FilmedTour) {
  filmed.push(tour)
}

// Which displays had still not reported a first paint when the camera stopped.
//
// The stills check this at the moment of capture (screenshot-report's
// recordUnpainted, and the reason is written out there); a tour's equivalent
// moment is its last frame, which is the state it was filmed to reach and the
// frame the poster comes from. A tour that ends on a display that never painted
// ships a clip whose payoff is a blank track, and every wait in the spec is
// silent about it, because waiting is best-effort in both harnesses.
export async function unpaintedDisplays(page: Page) {
  return page.evaluate(
    selector =>
      [
        ...new Set(
          [...document.querySelectorAll<HTMLElement>(selector)].map(
            el => el.dataset.testid ?? '(unnamed display)',
          ),
        ),
      ].sort(),
    PENDING_DISPLAYS,
  )
}

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

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(2)} MB`

// The frame against what the app actually filled, per tour, which is the number
// a re-frame is decided on. website/CLAUDE.md says to size a viewport from the
// run's own content report; this is that report, gathered rather than scattered
// through the log a tour at a time.
function printFrames() {
  printReport(
    `FRAMES (${filmed.length}) — the app's height at the first frame, its tallest, and the frame it was filmed in`,
    filmed.map(
      ({ name, frame, content, seconds, mp4Bytes }) =>
        `• ${name}: ${content.first}px → ${content.last}px, ${content.tallest}px tallest, ` +
        `in ${frame.width}×${frame.height} — ${seconds.toFixed(1)}s, ${mb(mp4Bytes)}`,
    ),
  )
}

export function printVideoSummary(failures: string[]) {
  if (filmed.length === 0) {
    return
  }
  printFrames()
  const clipped = filmed
    .filter(({ content, frame }) => content.tallest > frame.height)
    .sort(
      (a, b) =>
        b.content.tallest -
        b.frame.height -
        (a.content.tallest - a.frame.height),
    )
  if (clipped.length > 0) {
    printReport(
      `CONTENT TALLER THAN THE FRAME (${clipped.length}) — the camera cut these off at some point in the tour; raise the spec's viewportHeight by about this much`,
      clipped.map(
        ({ name, content, frame }) =>
          `• ${name}: ${content.tallest - frame.height}px of app below the frame at its tallest`,
      ),
    )
  }
  const slack = filmed
    .filter(
      ({ content, frame }) => frame.height - content.tallest > SLACK_WARN_PX,
    )
    .sort(
      (a, b) =>
        b.frame.height -
        b.content.tallest -
        (a.frame.height - a.content.tallest),
    )
  if (slack.length > 0) {
    printReport(
      `PAGE BACKGROUND UNDER THE APP (${slack.length}) — the frame is taller than anything the tour reached; lower the spec's viewportHeight by about this much`,
      slack.map(
        ({ name, content, frame }) =>
          `• ${name}: ${frame.height - content.tallest}px of blank under the tallest state`,
      ),
    )
  }
  const unpainted = filmed.filter(tour => tour.unpainted.length > 0)
  if (unpainted.length > 0) {
    printReport(
      `DISPLAYS NOT PAINTED AT THE LAST FRAME (${unpainted.length}) — the tour ends on a blank track, which is also the frame the poster comes from; raise the spec's settleMs or the last wait's timeout`,
      unpainted.map(
        ({ name, unpainted: ids }) => `• ${name}: ${ids.join(', ')}`,
      ),
    )
  }
  const slow = filmed.filter(tour => tour.slowSteps.length > 0)
  if (slow.length > 0) {
    printReport(
      `STEPS FILMED WHILE NOTHING HAPPENED (${slow.length}) — seconds of spinner in the finished clip; put \`cut: true\` on the wait`,
      slow.flatMap(({ name, slowSteps }) =>
        slowSteps.map(
          ([label, ms]) => `• ${name}: ${(ms / 1000).toFixed(1)}s on ${label}`,
        ),
      ),
    )
  }
  console.log(
    `\n${filmed.length} filmed, ${failures.length} failed — ` +
      `${(filmed.reduce((sum, t) => sum + t.seconds, 0) / 60).toFixed(1)} min of video, ` +
      `${mb(filmed.reduce((sum, t) => sum + t.mp4Bytes + t.posterBytes, 0))} on disk`,
  )
}
