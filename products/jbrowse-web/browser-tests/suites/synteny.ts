import {
  findByTestId,
  navigateToUrl,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'
import { lgvSnapshotTest, viewSnapshotTest } from '../suiteHelpers.ts'

import type { TestCase, TestSuite } from '../types.ts'

// The config's default session has a blank LinearSyntenyView (import form). The
// session's one synteny track makes Quick start the opening mode with that track
// already selected, so the rows it implies (volvox_snp / volvox) are shown up
// front and Launch alone renders the view.
const quickStartTest: TestCase = {
  name: 'import form quick start launches from a synteny track',
  fn: async page => {
    await navigateToUrl(
      page,
      'config=test_data%2Fvolvox%2Fconfig_synteny_snp.json',
    )
    const rows = await findByTestId(page, 'quick-start-rows', 30000)
    const text = await rows!.evaluate(e => e.textContent)
    if (!text.includes('volvox_snp') || !text.includes('volvox')) {
      throw new Error(`quick start rows not derived from track: ${text}`)
    }
    const launch = await page.waitForSelector('::-p-text(Launch)')
    await launch!.click()
    await findByTestId(page, 'synteny_canvas_done', 60000)
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
    const values = await rows!.$$eval('.MuiSelect-select', els =>
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
    waitTestId: 'synteny_canvas_done',
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
    await page.waitForSelector('[data-testid="synteny_canvas_done"]', {
      timeout: 60000,
    })
    await waitForDataLoaded(page, 60000)

    // full-page capture records the legend
    await findByTestId(page, 'color-by-legend', 60000)
    await dualSnapshot(
      page,
      'synteny-identity-legend-canvas',
      '[data-testid="synteny_canvas_done"]',
    )

    // dismiss it and confirm it is removed
    const close = await findByTestId(page, 'color-by-legend-close', 10000)
    await close!.click()
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
