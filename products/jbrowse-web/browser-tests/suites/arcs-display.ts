import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

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
    {
      name: 'read connections arcs (volvox_sv)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
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
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'arcs-read-connections-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'RNA-seq sashimi arcs (spliced alignments)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['spliced'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'arcs-rnaseq-sashimi-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'samplot mode (paired-end SV)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
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
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'arcs-samplot-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'samplot down mode (paired-end SV, scalebar left)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
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
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'arcs-samplot-down-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
    {
      name: 'BEDPE arcs (LinearPairedArcDisplay)',
      fn: async page => {
        // volvox_bedpe has arcs from ctgA:2700→34200 and cross-contig A↔B arcs
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_bedpe'],
            },
          ],
        })

        await findByTestId(page, 'arc-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'arcs-bedpe-canvas',
          '[data-testid="arc-display-done"]',
        )
      },
    },
    {
      name: 'paired-end stranded RNA-seq',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['paired_end_stranded_rnaseq'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'arcs-paired-end-rnaseq-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      },
    },
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

        await findByTestId(page, 'pileup-display-done', 60000)
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

        const collapseItem = await findByText(page, /Collapse introns/, 5000)
        if (!collapseItem) {
          throw new Error('"Collapse introns" not found in context menu')
        }
        await collapseItem.click()
        await delay(300)

        const submitBtn = await findByText(page, /^Submit$/, 5000)
        if (!submitBtn) {
          throw new Error('Submit button not found in collapse introns dialog')
        }
        await submitBtn.click()

        // A new LGV is added with displayedRegions set to the EDEN exon
        // blocks; wait for its pileup canvas to finish drawing
        await page.waitForFunction(
          () =>
            document.querySelectorAll('[data-testid="pileup-display-done"]')
              .length >= 2,
          { timeout: 60000 },
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
