import {
  PORT,
  appendGpuParam,
  findByTestId,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Miscellaneous Tracks',
  tests: [
    {
      name: 'SNP coverage rendering',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:13,010..13,610',
              tracks: ['volvox_alignments_pileup_coverage'],
            },
          ],
        })

        await findByTestId(page, 'pileup-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'misc-snpcoverage-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
    {
      name: 'NCBI alias adapter',
      fn: async page => {
        await page.goto(
          appendGpuParam(
            `http://localhost:${PORT}/?config=test_data/cfam2/config.json&sessionName=Test%20Session`,
          ),
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'misc-ncbi-alias-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'GFF3 track rendering',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:907..15,319',
              tracks: ['gff3tabix_genes'],
            },
          ],
        })

        await page.waitForSelector('[data-testid^="display-gff3tabix_genes"]', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid^="display-gff3tabix_genes"] canvas',
        )
        await canvasSnapshot(
          page,
          'misc-gff3-track-canvas',
          '[data-testid^="display-gff3tabix_genes"] canvas',
        )
      },
    },
  ],
}

export default suite
