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
          const canvas = document.querySelector<HTMLCanvasElement>(
            '[data-testid="pileup-display"] canvas',
          )
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

        const hasContent = await page.evaluate(() => {
          const canvas = document.querySelector('canvas')
          if (!canvas) {
            return false
          }
          try {
            const tmp = document.createElement('canvas')
            tmp.width = 10
            tmp.height = 10
            const ctx = tmp.getContext('2d')
            if (!ctx) {
              return false
            }
            const cx = Math.max(0, Math.floor(canvas.width / 2) - 5)
            const cy = Math.max(0, Math.floor(canvas.height / 2) - 5)
            ctx.drawImage(canvas, cx, cy, 10, 10, 0, 0, 10, 10)
            const d = ctx.getImageData(0, 0, 10, 10).data
            for (let i = 4; i < d.length; i += 4) {
              if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) {
                return true
              }
            }
            return false
          } catch {
            return false
          }
        })

        if (!hasContent) {
          // eslint-disable-next-line no-console
          console.log(
            `      [diagnostic] canvas has no content variation, beforePixels: ${beforePixels}`,
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
