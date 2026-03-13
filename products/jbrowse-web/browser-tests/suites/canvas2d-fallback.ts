import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, getBackend } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Canvas2D Fallback',
  tests: [
    {
      name: 'feature track renders with Canvas 2D',
      fn: async page => {
        if (getBackend() !== 'canvas2d') {
          return
        }
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
      },
    },
    {
      name: 'feature track canvas snapshot',
      fn: async page => {
        if (getBackend() !== 'canvas2d') {
          return
        }
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
          'canvas2d-feature-track',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'multiple tracks render together',
      fn: async page => {
        if (getBackend() !== 'canvas2d') {
          return
        }
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['volvox_filtered_vcf', 'volvox_cram'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        const displays = await page.$$('[data-testid^="display-"]')
        if (displays.length < 2) {
          await page.waitForFunction(
            () =>
              document.querySelectorAll('[data-testid^="display-"]').length >=
              2,
            { timeout: 60000 },
          )
        }
        await waitForDataLoaded(page)
      },
    },
    {
      name: 'zoom in/out does not crash',
      fn: async page => {
        if (getBackend() !== 'canvas2d') {
          return
        }
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
        await waitForDataLoaded(page)

        const zoomIn = await findByTestId(page, 'zoom_in', 10000)
        await zoomIn?.click()
        await delay(1000)

        const zoomOut = await findByTestId(page, 'zoom_out', 10000)
        await zoomOut?.click()
        await delay(1000)

        await waitForDataLoaded(page)
      },
    },
  ],
}

export default suite
