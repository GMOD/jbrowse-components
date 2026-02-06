import {
  PORT,
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { snapshot } from '../snapshot.ts'

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
              loc: 'ctgA:13,210..13,410',
              tracks: ['volvox_alignments_pileup_coverage'],
            },
          ],
        })

        await findByTestId(page, 'Blockset-snpcoverage', 60000)
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'misc-snpcoverage')
      },
    },
    {
      name: 'NCBI alias adapter',
      fn: async page => {
        await page.goto(
          `http://localhost:${PORT}/?config=test_data/cfam2/config.json&sessionName=Test%20Session`,
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'misc-ncbi-alias')
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

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'misc-gff3-track')
      },
    },
    {
      name: 'stats estimation pileup zoom',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1..50,001',
              tracks: ['volvox_cram_pileup'],
            },
          ],
        })

        await findByText(page, /Requested too much data/, 30000)
        const zoomIn = await findByTestId(page, 'zoom_in', 10000)
        await zoomIn?.click()
        await delay(2000)

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 30000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'misc-stats-estimation')
      },
    },
  ],
}

export default suite
