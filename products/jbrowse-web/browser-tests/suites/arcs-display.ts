import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
  waitForElementCount,
} from '../helpers.ts'
import { pageSnapshot } from '../snapshot.ts'
import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const pileup = 'pileup-display-done'

const suite: TestSuite = {
  name: 'Arcs and BEDPE Displays',
  tests: [
    {
      name: 'arc track renders',
      fn: async page => {
        // arc_track uses LinearArcDisplay (SVG renderer) with features at
        // ctgA:180-290; navigate close enough to see arcs clearly
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:150-350',
              tracks: ['arc_track'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await findByTestId(page, 'arc-display-done', 60000)
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'arcs-arc-test')
      },
    },
    lgvSnapshotTest({
      name: 'read connections arcs (volvox_sv)',
      snapshot: 'arcs-read-connections',
      loc: 'ctgA:2,707..48,600',
      tracks: [
        {
          trackId: 'volvox_sv',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            readConnections: 'arc',
          },
        },
      ],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'RNA-seq sashimi arcs (spliced alignments)',
      snapshot: 'arcs-rnaseq-sashimi',
      loc: 'ctgA:1-10000',
      tracks: ['spliced'],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'samplot mode (paired-end SV)',
      snapshot: 'arcs-samplot',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_sv_cram',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            readConnections: 'samplot',
          },
        },
      ],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'samplot down mode (paired-end SV, scalebar left)',
      snapshot: 'arcs-samplot-down',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_sv_cram',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            readConnections: 'samplot',
            readConnectionsDown: true,
          },
        },
      ],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'BEDPE arcs (LinearPairedArcDisplay)',
      snapshot: 'arcs-bedpe',
      // volvox_bedpe has arcs from ctgA:2700→34200 and cross-contig A↔B arcs
      loc: 'ctgA:1-50000',
      tracks: ['volvox_bedpe'],
      doneTestId: 'arc-display-done',
      // the arc display's `*-done` element IS the canvas, not a parent of one
      snapshotSelector: '[data-testid="arc-display-done"]',
    }),
    lgvSnapshotTest({
      name: 'paired-end stranded RNA-seq',
      snapshot: 'arcs-paired-end-rnaseq',
      loc: 'ctgA:1-10000',
      tracks: ['paired_end_stranded_rnaseq'],
      doneTestId: pileup,
    }),
    {
      name: 'collapse introns view with RNA-seq sashimi arcs (EDEN gene)',
      fn: async page => {
        // EDEN gene is at ctgA:1050-9000 with 3 isoforms (CDS blocks at
        // ~1200, ~3000, ~5000, ~7000). The spliced RNA-seq BAM has reads
        // covering this region with N-CIGAR operations that produce sashimi
        // arcs.
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1050-9000',
              tracks: ['gff3tabix_genes', 'spliced'],
            },
          ],
        })

        await findByTestId(page, pileup, 60000)
        await waitForDataLoaded(page)

        // Wait for the EDEN gene label overlay to appear — this confirms the
        // gene annotation canvas has finished drawing
        const edenLabel = await page.waitForSelector(
          '[data-testid="feature-name-EDEN"]',
          { timeout: 30000 },
        )
        if (!edenLabel) {
          throw new Error('EDEN gene label not found')
        }

        // Right-click the label to trigger the feature context menu
        await edenLabel.click({ button: 'right' })
        await delay(500)

        const collapseItem = await findByText(page, /Collapse introns/, 10000)
        if (!collapseItem) {
          throw new Error('"Collapse introns" not found in context menu')
        }
        await collapseItem.click()
        await delay(300)

        const submitBtn = await findByText(page, /^Submit$/, 10000)
        if (!submitBtn) {
          throw new Error('Submit button not found in collapse introns dialog')
        }
        await submitBtn.click()

        // A new LGV is added with displayedRegions set to the EDEN exon
        // blocks; wait for its pileup canvas to finish drawing
        await waitForElementCount(
          page,
          '[data-testid="pileup-display-done"]',
          2,
        )
        await waitForDataLoaded(page)

        // Full-page snapshot shows both views: original + collapsed exon view
        // with sashimi arcs spanning the compressed intron gaps
        await pageSnapshot(page, 'arcs-collapse-introns-sashimi')
      },
    },
  ],
}

export default suite
