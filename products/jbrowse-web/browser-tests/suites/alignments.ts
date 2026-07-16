import {
  assertContextMenuContains,
  delay,
  findByTestId,
  findByText,
  navigateToApp,
  navigateWithSessionSpec,
  openTrack,
  rightClickAtFraction,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'
import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const pileup = 'pileup-display-done'

const suite: TestSuite = {
  name: 'Alignments Track',
  tests: [
    {
      name: 'loads BAM track',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_alignments')
        await findByTestId(page, pileup, 60000)
      },
    },
    {
      name: 'loads CRAM track',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_cram_alignments')
        await findByTestId(page, pileup, 60000)
      },
    },
    {
      // opens the track via the UI track-selector rather than a session spec, so
      // it stays hand-rolled (exercises the open-track flow, not just render)
      name: 'BAM track screenshot',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_alignments')
        await findByTestId(page, pileup, 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'alignments-bam-canvas',
          `[data-testid="${pileup}"] canvas`,
        )
      },
    },
    lgvSnapshotTest({
      name: 'volvox_sv track screenshot',
      snapshot: 'alignments-volvox-sv',
      loc: 'ctgA:2,707..48,600',
      tracks: ['volvox_sv'],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'volvox long reads with SV (zoomed out)',
      snapshot: 'alignments-long-reads-sv-zoomed-out',
      loc: 'ctgA:1..50,001',
      tracks: ['volvox-long-reads-sv-bam'],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'volvox long reads with SV (linked reads)',
      snapshot: 'alignments-long-reads-sv-linked',
      loc: 'ctgA:1..50,001',
      tracks: [
        {
          trackId: 'volvox-long-reads-sv-bam',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            linkedReads: 'normal',
          },
        },
      ],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'pileup + coverage track',
      snapshot: 'alignments-pileup-coverage',
      loc: 'ctgA:1-4000',
      tracks: ['volvox_alignments_pileup_coverage'],
      doneTestId: pileup,
    }),
    {
      name: 'read vs ref context menu appears',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:500-700',
              tracks: ['volvox_alignments_pileup_coverage'],
            },
          ],
        })
        await findByTestId(page, pileup, 60000)
        await waitForDataLoaded(page)
        await delay(1000)

        // Right-click at 30% height (in the dense pileup area, below coverage).
        // At ctgA:500-700 zoomed in, this reliably hits a read.
        await rightClickAtFraction(
          page,
          `[data-testid="${pileup}"] canvas`,
          0.5,
          0.3,
        )
        await delay(500)

        // pushLaunchViewMenuItem nests view-launching entries under a
        // "Launch view" submenu, so open that before looking for the item
        await assertContextMenuContains(page, 'Launch view')
        await (await findByText(page, 'Launch view'))?.hover()
        await delay(500)
        await findByText(page, 'Linear read vs ref')
      },
    },
    lgvSnapshotTest({
      name: 'sub-pixel mismatch blending with coverage (zoomed out)',
      snapshot: 'alignments-subpixel-mismatch-blend',
      // Verify no white spots from disabled blending: coverage renderer disables
      // gl.BLEND after indicator draw; pileup renderer must re-enable it so
      // sub-pixel mismatches alpha-blend with reads rather than replacing them
      // with near-transparent pixels
      loc: 'ctgA:1..10,000',
      tracks: ['volvox_alignments_pileup_coverage'],
      doneTestId: pileup,
    }),
  ],
}

export default suite
