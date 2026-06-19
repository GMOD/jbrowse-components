import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
  waitForElementCount,
} from '../helpers.ts'
import { pageSnapshot } from '../snapshot.ts'
import { viewSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const threeWayView = {
  type: 'LinearSyntenyView',
  tracks: [['volvox_ins.paf'], ['volvox_del.paf']],
  views: [
    { loc: 'ctgA:1-50000', assembly: 'volvox_ins' },
    { loc: 'ctgA:1-50000', assembly: 'volvox' },
    { loc: 'ctgA:1-50000', assembly: 'volvox_del' },
  ],
}

const suite: TestSuite = {
  name: 'Multi-Way Synteny Views',
  tests: [
    viewSnapshotTest({
      name: '3-way synteny view (volvox ins/del)',
      snapshot: 'multiway-synteny-3way',
      view: threeWayView,
      waitTestId: 'synteny_canvas_done',
    }),
    {
      name: '3-way synteny full page screenshot',
      fn: async page => {
        await navigateWithSessionSpec(page, { views: [threeWayView] })
        await findByTestId(page, 'synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await waitForElementCount(
          page,
          '[data-testid="synteny_canvas_done"]',
          2,
        )
        await delay(2000)
        await pageSnapshot(page, 'multiway-synteny-3way-fullpage')
      },
    },
    viewSnapshotTest({
      name: '2-way synteny with gene tracks (volvox)',
      snapshot: 'multiway-synteny-2way-with-genes',
      view: {
        type: 'LinearSyntenyView',
        tracks: ['volvox_fake_synteny'],
        views: [
          {
            loc: 'ctgA:1-50000',
            assembly: 'volvox',
            tracks: ['gff3tabix_genes'],
          },
          {
            loc: 'ctgA:1-50000',
            assembly: 'volvox',
            tracks: ['gff3tabix_genes'],
          },
        ],
      },
      waitTestId: 'synteny_canvas_done',
    }),
    viewSnapshotTest({
      name: 'dotplot view with grape vs peach (zoomed region)',
      snapshot: 'multiway-dotplot-grape-peach-zoomed',
      config: 'test_data/grape_peach_synteny/config.json',
      view: {
        type: 'DotplotView',
        tracks: ['subset'],
        views: [
          { loc: 'Pp01:26,000,000..31,000,000', assembly: 'peach' },
          { loc: 'chr1:1..2,000,000', assembly: 'grape' },
        ],
      },
      waitTestId: 'dotplot_webgl_canvas_done',
    }),
  ],
}

export default suite
