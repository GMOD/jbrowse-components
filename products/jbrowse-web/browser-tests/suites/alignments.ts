import {
  findByTestId,
  navigateToApp,
  navigateWithSessionSpec,
  openTrack,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Alignments Track',
  tests: [
    {
      name: 'loads BAM track',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_alignments')
        await findByTestId(page, 'pileup-display', 60000)
      },
    },
    {
      name: 'loads CRAM track',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_cram_alignments')
        await findByTestId(page, 'pileup-display', 60000)
      },
    },
    {
      name: 'BAM track screenshot',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_alignments')
        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'alignments-bam-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'volvox_sv track screenshot',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2,707..48,600',
              tracks: ['volvox_sv'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'alignments-volvox-sv-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'volvox long reads with SV (zoomed out)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1..50,001',
              tracks: ['volvox-long-reads-sv-bam'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'alignments-long-reads-sv-zoomed-out-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'pileup + coverage track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_alignments_pileup_coverage'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'alignments-pileup-coverage-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'sub-pixel mismatch blending with coverage (zoomed out)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1..10,000',
              tracks: ['volvox_alignments_pileup_coverage'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        // Verify no white spots from disabled blending: coverage renderer
        // disables gl.BLEND after indicator draw; pileup renderer must
        // re-enable it so sub-pixel mismatches alpha-blend with reads
        // rather than replacing them with near-transparent pixels
        await canvasSnapshot(
          page,
          'alignments-subpixel-mismatch-blend-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
  ],
}

export default suite
