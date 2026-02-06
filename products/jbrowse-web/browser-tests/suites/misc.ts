import {
  PORT,
  delay,
  findByTestId,
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
              loc: 'ctgA:13,010..13,610',
              tracks: ['volvox_alignments_pileup_coverage'],
            },
          ],
        })

        await findByTestId(page, 'Blockset-pileup', 60000)
        await waitForLoadingToComplete(page)
        await delay(2000)
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
          '[data-testid^="display-gff3tabix_genes"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(2000)
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

        await delay(10000)
        await page.screenshot({ path: '/tmp/debug-stats.png' })
        const bodyText = await page.evaluate(() => document.body.innerText)
        console.log('Body text contains "Requested":', bodyText.includes('Requested'))
        console.log('Body text contains "Zoom":', bodyText.includes('Zoom'))
        console.log('Body text snippet:', bodyText.substring(0, 500))

        await page.waitForFunction(
          () =>
            document.body.innerText.includes('Requested too much data') ||
            document.body.innerText.includes('Zoom in'),
          { timeout: 60000 },
        )
        const zoomIn = await findByTestId(page, 'zoom_in', 10000)
        await zoomIn?.click()
        await delay(3000)

        await page.waitForSelector(
          '[data-testid^="prerendered_canvas"]',
          { timeout: 60000 },
        )
        await waitForLoadingToComplete(page)
        await delay(1000)
        await snapshot(page, 'misc-stats-estimation')
      },
    },
  ],
}

export default suite
