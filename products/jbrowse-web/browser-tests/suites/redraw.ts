import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Redraw on Zoom',
  tests: [
    {
      name: 'alignments track redraws after zoom out',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1000-2000',
              tracks: ['volvox_cram'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )

        const beforePixels = await page.evaluate(() => {
          const canvas = document.querySelector(
            '[data-testid="pileup-display"] canvas',
          ) as HTMLCanvasElement | null
          if (!canvas) {
            return 0
          }
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            return 0
          }
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          let nonZero = 0
          for (let i = 3; i < data.length; i += 4) {
            if (data[i]! > 0) {
              nonZero++
            }
          }
          return nonZero
        })

        const zoomOut = await findByTestId(page, 'zoom_out', 10000)
        await zoomOut?.click()
        await zoomOut?.click()
        await zoomOut?.click()
        await delay(2000)
        await waitForDataLoaded(page, 90000)

        const drawnTrue = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="drawn-true"]')
          return el !== null
        })

        if (!drawnTrue) {
          const drawnFalse = await page.evaluate(() => {
            const el = document.querySelector('[data-testid="drawn-false"]')
            return el !== null
          })
          console.log(
            `      [diagnostic] drawn-true: ${drawnTrue}, drawn-false: ${drawnFalse}, beforePixels: ${beforePixels}`,
          )
        }
      },
    },
    {
      name: 'feature track redraws after zoom out',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1000-2000',
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

        const zoomOut = await findByTestId(page, 'zoom_out', 10000)
        await zoomOut?.click()
        await zoomOut?.click()
        await delay(2000)
        await waitForDataLoaded(page, 90000)

        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
      },
    },
    {
      name: 'wiggle track fills visible region after zoom',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1000-3000',
              tracks: ['volvox_cram_snpcoverage'],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await page.waitForSelector('[data-testid^="display-"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')

        const zoomOut = await findByTestId(page, 'zoom_out', 10000)
        await zoomOut?.click()
        await zoomOut?.click()
        await delay(2000)
        await waitForDataLoaded(page, 90000)

        await waitForCanvasRendered(
          page,
          '[data-testid^="display-"] canvas',
          60000,
        )
      },
    },
  ],
}

export default suite
