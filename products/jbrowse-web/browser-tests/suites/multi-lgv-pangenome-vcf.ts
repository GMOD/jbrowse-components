import {
  assertCanvasHasContent,
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

// Fast, fully-local stand-in for the requiresRemote HPRC chr20 pangenome
// suite. Mirrors the GRAPH_PLAN "v1" scheme: a MultiLGVSyntenyDisplay fed by
// a tabix-indexed odgi-untangle PAF (TabixPAFAdapter) paired with a separate
// standard VCF track (vg deconstruct output) that carries the per-base
// SNP/indel detail the block-level synteny can't show.
//
//   synteny  -> volvox.untangle.paf.gz       (volvox_untangle_tabix_paf)
//   per-base -> volvox_pangenome_50.vcf.gz   (volvox_pangenome_50_vcf)
//
// Both reference volvox ctgA, so they overlay row-aligned in one LGV exactly
// as the HPRC chr20 config does. assertCanvasHasContent is the explicit
// "shows interesting data" gate — plain snapshots treat a blank canvas as a
// pass.

const syntenyCanvas = '[data-testid="multi_synteny_canvas_done"]'
// displayId is `${trackId}-${displayType}`, `-done` is appended once drawn
const vcfCanvas =
  '[data-testid^="display-volvox_pangenome_50_vcf"][data-testid$="-done"] canvas'

// the untangle-PAF synteny track + the per-base vg-deconstruct VCF track,
// both on volvox ctgA so they render row-aligned in one LGV
const tracks = [
  {
    trackId: 'volvox_untangle_tabix_paf',
    displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
  },
  'volvox_pangenome_50_vcf',
]

const suite: TestSuite = {
  name: 'MultiLGV pangenome + per-base VCF (local chr20 stand-in)',
  tests: [
    {
      name: 'synteny blocks and per-base VCF render together with real data',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-3000',
              tracks,
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)

        // synteny display drew identity-colored haplotype blocks
        await assertCanvasHasContent(page, syntenyCanvas)
        // VCF track drew per-base variant features in the same window
        await assertCanvasHasContent(page, vcfCanvas, {
          minDistinctColors: 3,
        })

        await canvasSnapshot(
          page,
          'multi-lgv-pangenome-vcf-synteny-canvas',
          syntenyCanvas,
        )
        await canvasSnapshot(
          page,
          'multi-lgv-pangenome-vcf-variants-canvas',
          vcfCanvas,
        )
      },
    },
    {
      // Zoomed to a ~130 bp window holding five vg-deconstruct SNP sites
      // (ctgA 133/161/205/209/242). At this bpPerPx each variant is many
      // pixels wide — the per-base SNP detail the synteny block hides.
      name: 'per-base SNPs are visible when zoomed into a variant cluster',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:130-260',
              tracks,
            },
          ],
        })

        await findByTestId(page, 'multi_synteny_canvas_done', 60000)
        await waitForDataLoaded(page)
        await delay(2000)

        await assertCanvasHasContent(page, syntenyCanvas)
        await assertCanvasHasContent(page, vcfCanvas, { minDistinctColors: 3 })

        await canvasSnapshot(
          page,
          'multi-lgv-pangenome-vcf-zoomed-variants-canvas',
          vcfCanvas,
        )
      },
    },
  ],
}

export default suite
