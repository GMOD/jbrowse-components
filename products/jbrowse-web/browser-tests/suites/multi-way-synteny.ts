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

// Same ins/volvox/del stack, but BOTH bands are backed by a single all-vs-all
// PanSN PAF track (volvox_all_vs_all, assemblyNames lists all three) instead of
// two separate pairwise PAFs. The synteny RPC passes each band's target
// assembly, and the AllVsAllPAFAdapter filters the shared file to that pair.
// Exercises the multi-genome one-track-backs-all-bands path end-to-end (unit
// tests only hit the adapter in isolation).
const threeWayAllVsAllView = {
  type: 'LinearSyntenyView',
  tracks: [['volvox_all_vs_all'], ['volvox_all_vs_all']],
  views: [
    { loc: 'ctgA:1-50000', assembly: 'volvox_ins' },
    { loc: 'ctgA:1-50000', assembly: 'volvox' },
    { loc: 'ctgA:1-50000', assembly: 'volvox_del' },
  ],
}

// Same stack again, but the shared all-vs-all track is the tabix-indexed
// (make-pif) form: AllVsAllIndexedPAFAdapter range-queries the PanSN seqid per
// band instead of loading the whole file. Should render identically to the
// in-memory all-vs-all view above.
const threeWayAllVsAllIndexedView = {
  type: 'LinearSyntenyView',
  tracks: [['volvox_all_vs_all_indexed'], ['volvox_all_vs_all_indexed']],
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
      name: '3-way synteny from one all-vs-all PAF (volvox ins/del)',
      snapshot: 'multiway-synteny-3way-allvsall',
      view: threeWayAllVsAllView,
      waitTestId: 'synteny_canvas_done',
    }),
    viewSnapshotTest({
      name: '3-way synteny from one indexed all-vs-all PIF (volvox ins/del)',
      snapshot: 'multiway-synteny-3way-allvsall-indexed',
      view: threeWayAllVsAllIndexedView,
      waitTestId: 'synteny_canvas_done',
    }),
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
