import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  findByTestId,
  findDisplayPainted,
  navigateToUrl,
  navigateWithSessionSpec,
  waitForDataLoaded,
  waitForDisplayPaint,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'
import { lgvSnapshotTest, viewSnapshotTest } from '../suiteHelpers.ts'

import type { TestCase, TestSuite } from '../types.ts'

// The config's default session has a blank LinearSyntenyView (import form). The
// session's one synteny track makes Quick start the opening mode with that track
// already selected, so the rows it implies (volvox_snp / volvox) are shown up
// front and Launch alone renders the view.
// ADR-076: the shared canvas publishes `data-display-phase` beside
// `data-display-drawn`, so `displaySettled` and every other DOM-level doneness
// wait works on a comparative page. It could not before — those waits key on an
// attribute this canvas did not carry, which makes each of them an assertion
// about an absent selector, satisfied by a canvas that has not begun.
//
// This has to run in a browser: `painted` never flips without a compositor, so
// the jsdom tests that pin the model side call `markCanvasDrawn()` by hand and
// cannot see whether the attribute reaches the DOM at all.
const phaseTest: TestCase = {
  name: 'a synteny level publishes a settled display phase',
  fn: async page => {
    await navigateWithSessionSpec(
      page,
      {
        views: [
          {
            type: 'LinearSyntenyView',
            tracks: [['volvox_snp_synteny']],
            views: [{ assembly: 'volvox' }, { assembly: 'volvox_snp' }],
          },
        ],
      },
      'test_data/volvox/config_synteny_snp.json',
    )
    const canvas = await findDisplayPainted(page, 'synteny_canvas', 60000)
    await waitForDataLoaded(page, 60000)
    const ready = await page
      .waitForFunction(
        () =>
          document.querySelector<HTMLElement>('[data-testid="synteny_canvas"]')
            ?.dataset.displayPhase === 'ready' || undefined,
        { timeout: 60000 },
      )
      .catch(() => undefined)
    if (!ready) {
      const actual = await canvas.evaluate(
        e => (e as HTMLElement).dataset.displayPhase,
      )
      throw new Error(
        `synteny_canvas never reported phase=ready (saw ${actual ?? 'no attribute'})`,
      )
    }
  },
}

const quickStartTest: TestCase = {
  name: 'import form quick start launches from a synteny track',
  fn: async page => {
    await navigateToUrl(
      page,
      'config=test_data%2Fvolvox%2Fconfig_synteny_snp.json',
    )
    const rows = await findByTestId(page, 'quick-start-rows', 30000)
    const text = await rows.evaluate(e => e.textContent)
    if (!text.includes('volvox_snp') || !text.includes('volvox')) {
      throw new Error(`quick start rows not derived from track: ${text}`)
    }
    const launch = await page.waitForSelector('::-p-text(Launch)')
    await launch!.click()
    await findDisplayPainted(page, 'synteny_canvas', 60000)
    await waitForDataLoaded(page, 60000)
  },
}

// Switching Quick start -> Manual hands over the track's assemblies rather than
// resetting to the default, so the manual rows open on what Quick start set up.
const quickStartHandoffTest: TestCase = {
  name: 'import form Manual inherits the Quick start track assemblies',
  fn: async page => {
    await navigateToUrl(
      page,
      'config=test_data%2Fvolvox%2Fconfig_synteny_snp.json',
    )
    await findByTestId(page, 'quick-start-rows', 30000)
    const manual = await page.waitForSelector('::-p-text(Manual)')
    await manual!.click()
    const rows = await findByTestId(page, 'synteny-assembly-rows', 10000)
    const values = await rows.$$eval('.MuiSelect-select', els =>
      els.map(e => e.textContent),
    )
    if (!values.includes('volvox_snp') || !values.includes('volvox')) {
      throw new Error(`manual rows did not inherit: ${JSON.stringify(values)}`)
    }
  },
}

function syntenyTest(
  name: string,
  snapshotName: string,
  peachLoc: string,
  grapeLoc: string,
  swapped = false,
): TestCase {
  const views = swapped
    ? [
        { loc: grapeLoc, assembly: 'grape' },
        { loc: peachLoc, assembly: 'peach' },
      ]
    : [
        { loc: peachLoc, assembly: 'peach' },
        { loc: grapeLoc, assembly: 'grape' },
      ]
  return viewSnapshotTest({
    name,
    snapshot: snapshotName,
    config: 'test_data/grape_peach_synteny/config.json',
    view: { type: 'LinearSyntenyView', tracks: ['subset'], views },
    waitTestId: 'synteny_canvas',
  })
}

// Color-by identity (viridis ramp) with the floating legend. The targeted
// canvas capture pins the viridis coloring; the full-page capture includes the
// top-right DOM legend overlay. Also drives the legend's dismiss button to
// prove it hides on click.
const identityLegendTest: TestCase = {
  name: 'color by identity shows viridis ramp + dismissible legend',
  fn: async page => {
    await navigateWithSessionSpec(
      page,
      {
        views: [
          {
            type: 'LinearSyntenyView',
            tracks: ['subset'],
            colorBy: 'identity',
            // opt in explicitly: the legend defaulted to on when it was added
            // (477292a223) but is off by default since e9e8eeff9c
            showColorLegend: true,
            views: [
              { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
              { loc: 'chr1:316,306..316,364', assembly: 'grape' },
            ],
          },
        ],
      },
      'test_data/grape_peach_synteny/config.json',
    )
    await waitForDisplayPaint(page, displayPainted('synteny_canvas'), 60000)
    await waitForDataLoaded(page, 60000)

    // full-page capture records the legend
    await findByTestId(page, 'color-by-legend', 60000)
    await dualSnapshot(
      page,
      'synteny-identity-legend-canvas',
      displayPainted('synteny_canvas'),
    )

    // dismiss it and confirm it is removed
    const close = await findByTestId(page, 'color-by-legend-close', 10000)
    await close.click()
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-testid="color-by-legend"]').length ===
        0,
      { timeout: 10000 },
    )
  },
}

const suite: TestSuite = {
  name: 'Synteny Views',
  tests: [
    quickStartTest,
    phaseTest,
    quickStartHandoffTest,
    identityLegendTest,
    syntenyTest(
      'horizontally flipped inverted alignment',
      'synteny-flipped-inverted',
      'Pp01:28,845,211..28,845,272[rev]',
      'chr1:316,306..316,364',
    ),
    syntenyTest(
      'regular orientation inverted alignment',
      'synteny-regular-inverted',
      'Pp01:28,845,211..28,845,272',
      'chr1:316,306..316,364',
    ),
    lgvSnapshotTest({
      name: 'LGV synteny track',
      snapshot: 'synteny-lgv-paf',
      loc: 'ctgA:30,222..33,669',
      tracks: ['volvox_ins.paf'],
    }),
    lgvSnapshotTest({
      name: 'LGV synteny per-base mismatches from cs tag',
      snapshot: 'synteny-lgv-cs-mismatches',
      config: 'test_data/volvox/config_synteny_snp.json',
      assembly: 'volvox',
      loc: 'ctgA:1..400',
      tracks: ['volvox_snp_synteny'],
    }),
  ],
}

export default suite
