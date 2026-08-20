import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  delay,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// The tooltip both comparative views show for the alignment under the cursor is
// one component (`ComparativeTooltip`) fed by two line builders, and no jest
// test can see the half that matters here: the lines are ONE text node joined by
// `\n` under `white-space: pre-wrap`, so whether they land as separate lines on
// screen is a layout question. jsdom answers it wrong either way.
//
// Same reasoning as cursor-guides: an affordance that exists only while a real
// pointer is over the canvas, reached through a real pick, is not covered by a
// snapshot — a dead tooltip and a tooltip nobody hovered look identical.
//
// The fixture is `volvox_snp.paf` (fully local): its ctgA row aligns nearly the
// whole contig, so a pick lands anywhere along the diagonal, and its columns
// carry a mapping quality (60) and enough to derive an identity — which is what
// makes the labels assertable at all.
const CONFIG = 'test_data/volvox/config_synteny_snp.json'

// BaseTooltip portals to a bare div parented to <body> with no role or testid,
// so it is identified structurally: the body-level div that isn't the app root.
// Lifted from cursor-guides, where the same shape is read.
function findTooltip() {
  const app = document.body.children[1]
  return [...document.body.children].find(
    e => e.tagName === 'DIV' && e !== app && e.textContent,
  )
}

function tooltipState(page: Page) {
  return page.evaluate(`(() => {
    const el = (${findTooltip})()
    if (!el) {
      return undefined
    }
    // One rect per LINE BOX the text actually laid out as — the only readable
    // answer to "did the newlines break lines", and the reason this check is
    // here and not in jest.
    const range = document.createRange()
    range.selectNodeContents(el.firstElementChild ?? el)
    return {
      text: el.textContent ?? '',
      rects: range.getClientRects().length,
    }
  })()`) as Promise<{ text: string; rects: number } | undefined>
}

async function boxOf(page: Page, testId: string) {
  return page.$eval(`[data-testid="${testId}"]`, el => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
}

// Sweep a real pointer over the canvas until the MODEL says a feature is
// hovered, then hand back the tooltip as rendered. Driven by the model's own
// answer rather than by a coordinate someone measured once: a pick depends on
// the live pan, the ribbon's perpendicular width and the alignment-length
// filter, so a hard-coded pixel is a test that rots quietly.
async function hoverUntilFeature(
  page: Page,
  testId: string,
  hovered: () => unknown,
) {
  const box = await boxOf(page, testId)
  for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    for (const fx of [0.5, 0.3, 0.7, 0.15, 0.85, 0.4, 0.6]) {
      const x = box.x + box.width * fx
      const y = box.y + box.height * fy
      // two moves, so the display sees motion rather than a teleport
      await page.mouse.move(x - 20, y - 8)
      await page.mouse.move(x, y, { steps: 3 })
      await delay(150)
      if (await page.evaluate(`(${hovered})()`)) {
        const tooltip = await tooltipState(page)
        if (!tooltip) {
          throw new Error(`feature hovered at ${fx},${fy} but no tooltip drawn`)
        }
        return tooltip
      }
    }
  }
  throw new Error(`no pick anywhere over ${testId} — fixture or pick engine?`)
}

function assert(cond: boolean, message: string) {
  if (!cond) {
    throw new Error(message)
  }
}

// The lines are one text node joined by `\n`, so `white-space` is the whole
// mechanism: under `pre-wrap` every `\n` starts a line box, and a long line may
// then wrap into more. Under anything else the newlines are just spaces and the
// text reflows into fewer boxes than it has lines — which is the bug this holds.
//
// Counting LINE BOXES, not pixels: measured on this fixture's 8-line tooltip,
// `pre-wrap` lays out 15 boxes / 142px tall / 203px wide, and `normal` lays out
// 4 boxes / 75px / 300px (maxWidth). A height threshold cannot tell those apart
// — 75px is several lines of wrapped text — which is why an earlier spelling of
// this check passed against a deliberately broken build.
function assertLinesLaidOut(
  tooltip: { text: string; rects: number },
  where: string,
) {
  const lines = tooltip.text.split('\n')
  assert(
    lines.length >= 5,
    `${where}: expected several lines, got ${JSON.stringify(tooltip.text)}`,
  )
  assert(
    tooltip.rects >= lines.length,
    `${where}: ${lines.length} lines laid out as only ${tooltip.rects} line boxes — the newlines are rendering as spaces`,
  )
}

// A refName and a feature name come out of an alignment file, and these lines
// are text nodes precisely so nothing on the path has to be sanitized. If a
// builder ever goes back to joining with markup, it arrives here as characters.
function assertNoMarkup(tooltip: { text: string }, where: string) {
  assert(
    !tooltip.text.includes('<'),
    `${where}: markup reached the tooltip: ${JSON.stringify(tooltip.text)}`,
  )
}

const suite: TestSuite = {
  name: 'comparative-tooltips',
  tests: [
    {
      name: 'synteny ribbon tooltip: labelled channels, one line each',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['volvox_snp_synteny'],
                levelHeights: [250],
                views: [
                  { loc: 'ctgA', assembly: 'volvox_snp' },
                  { loc: 'ctgA', assembly: 'volvox' },
                ],
              },
            ],
          },
          CONFIG,
        )
        await page.waitForSelector(displayPainted('synteny_canvas'), {
          timeout: 60000,
        })
        await waitForDataLoaded(page, 60000)
        await delay(1000)

        const tooltip = await hoverUntilFeature(page, 'synteny_canvas', () =>
          (window as any).JBrowseRootModel.session.views[0].levels?.some(
            (l: any) =>
              l.linearSyntenyDisplays?.some((d: any) => d.tooltipLines),
          ),
        )
        assertLinesLaidOut(tooltip, 'synteny')
        assertNoMarkup(tooltip, 'synteny')
        for (const line of ['Loc1:', 'Loc2:', 'Inverted:', 'Identity:']) {
          assert(
            tooltip.text.includes(line),
            `synteny tooltip has no ${line} line: ${JSON.stringify(tooltip.text)}`,
          )
        }
        // The channel labels are the legend's, not the wire names the packed
        // arrays are keyed by — `mappingQual: 60` was the tooltip reading a
        // buffer out loud.
        assert(
          tooltip.text.includes('Mapping quality:'),
          `synteny tooltip did not label mappingQual: ${JSON.stringify(tooltip.text)}`,
        )
        assert(
          !tooltip.text.includes('mappingQual'),
          `synteny tooltip printed a wire name: ${JSON.stringify(tooltip.text)}`,
        )
      },
    },
    {
      name: 'dotplot alignment tooltip: same channels, same labels',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'DotplotView',
                tracks: ['volvox_snp_synteny'],
                views: [{ assembly: 'volvox_snp' }, { assembly: 'volvox' }],
              },
            ],
          },
          CONFIG,
        )
        await page.waitForSelector(displayPainted('dotplot_webgl_canvas'), {
          timeout: 60000,
        })
        await waitForDataLoaded(page, 60000)
        await delay(1000)

        const tooltip = await hoverUntilFeature(
          page,
          'dotplot_webgl_canvas',
          () =>
            (window as any).JBrowseRootModel.session.views[0]
              .hoveredTooltipLines,
        )
        assertLinesLaidOut(tooltip, 'dotplot')
        assertNoMarkup(tooltip, 'dotplot')
        // The dotplot names its two axes rather than Loc1/Loc2 — it has axes,
        // where a stacked view has rows — but the channels below are the same
        // builder as synteny's, and the labels have to match.
        for (const line of ['x: ', 'y: ', 'Identity:', 'Mapping quality:']) {
          assert(
            tooltip.text.includes(line),
            `dotplot tooltip has no ${line} line: ${JSON.stringify(tooltip.text)}`,
          )
        }
      },
    },
  ],
}

export default suite
