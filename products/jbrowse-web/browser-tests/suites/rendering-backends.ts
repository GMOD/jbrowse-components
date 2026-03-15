import {
  PORT,
  appendGpuParam,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Cross-Backend Rendering',
  tests: [
    {
      name: 'feature track (VCF variants)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['volvox_filtered_vcf'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'xbackend-vcf-features',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'feature track (GFF3 genes)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:907..15319',
              tracks: ['gff3tabix_genes'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-gff3tabix_genes"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid^="display-gff3tabix_genes"] canvas',
        )
        await canvasSnapshot(
          page,
          'xbackend-gff3-genes',
          '[data-testid^="display-gff3tabix_genes"] canvas',
        )
      },
    },
    {
      name: 'wiggle track (GC content)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:39433..39804',
              tracks: ['volvox_gc'],
            },
          ],
        })

        await findByTestId(page, 'wiggle-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'xbackend-wiggle-gc',
          '[data-testid="wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'alignments pileup (BAM)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_bam_pileup'],
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
          'xbackend-alignments-bam',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'alignments pileup (CRAM)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_cram'],
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
          'xbackend-alignments-cram',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'SNP coverage track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:13010..13610',
              tracks: ['volvox_cram_snpcoverage'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'xbackend-snpcoverage',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'multi-wiggle xyplot',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi'],
            },
          ],
        })

        await findByTestId(page, 'multi-wiggle-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="multi-wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'xbackend-multiwiggle-xyplot',
          '[data-testid="multi-wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'SV alignments (structural variants)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2707..48600',
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
          'xbackend-sv-alignments',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'session spec with jexl color callback',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2707..8600',
              tracks: ['volvox_test_vcf_jexl'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'xbackend-jexl-vcf',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'sequence track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1..200',
              tracks: ['volvox_refseq'],
            },
          ],
        })

        await findByTestId(page, 'sequence-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="sequence-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'xbackend-sequence',
          '[data-testid="sequence-display"] canvas',
        )
      },
    },
    {
      name: 'alignments with coverage + pileup combined',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_cram_alignments'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'xbackend-alignments-combined',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'synteny LGV track (PAF)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:30,222..33,669',
              tracks: ['volvox_ins.paf'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'xbackend-synteny-lgv-paf',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'synteny linear view',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['subset'],
                views: [
                  { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
                  { loc: 'chr1:316,306..316,364', assembly: 'grape' },
                ],
              },
            ],
          },
          'test_data/grape_peach_synteny/config.json',
        )

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await canvasSnapshot(
          page,
          'xbackend-synteny-linear',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
    {
      name: 'dotplot view',
      fn: async page => {
        await page.goto(
          appendGpuParam(
            `http://localhost:${PORT}/?config=test_data/config_dotplot.json&sessionName=Test%20Session`,
          ),
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await page.waitForSelector('[data-testid="dotplot_webgl_canvas"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="dotplot_webgl_canvas"]',
        )
        await canvasSnapshot(
          page,
          'xbackend-dotplot',
          '[data-testid="dotplot_webgl_canvas"]',
        )
      },
    },
  ],
}

export default suite
