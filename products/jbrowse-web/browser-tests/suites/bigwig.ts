import { PNG } from 'pngjs'

import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'BigWig Tracks',
  tests: [
    {
      name: 'GC content track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:39,433..39,804',
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
          'bigwig-gc-content-canvas',
          '[data-testid="wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'MultiBigWig xyplot',
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
          'bigwig-multibigwig-xyplot-canvas',
          '[data-testid="multi-wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'MultiBigWig multirowxy',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi_multirowxy'],
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
          'bigwig-multibigwig-multirowxy-canvas',
          '[data-testid="multi-wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'MultiBigWig multirowdensity',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi_multirowdensity'],
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
          'bigwig-multibigwig-multirowdensity-canvas',
          '[data-testid="multi-wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'MultiBigWig multirowline',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi_multirowline'],
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
          'bigwig-multibigwig-multirowline-canvas',
          '[data-testid="multi-wiggle-display"] canvas',
        )
      },
    },
    {
      name: 'MultiBigWig multirowxy has distinct colors per row',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_microarray_multi_multirowxy'],
            },
          ],
        })

        await findByTestId(page, 'multi-wiggle-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="multi-wiggle-display"] canvas',
        )
        await delay(500)

        const el = await page.waitForSelector(
          '[data-testid="multi-wiggle-display"] canvas',
          { timeout: 10000 },
        )
        if (!el) {
          throw new Error('Canvas not found')
        }
        const screenshot = await el.screenshot({ type: 'png' })
        // @ts-expect-error Uint8Array works at runtime
        const img = PNG.sync.read(screenshot)
        const { width, height, data } = img
        const numRows = 3
        const rowHeight = Math.floor(height / numRows)

        function getDominantColorForRow(row: number) {
          const centerY = Math.floor(row * rowHeight + rowHeight / 2)
          let bestR = 0
          let bestG = 0
          let bestB = 0
          let bestSaturation = 0

          for (let dy = -2; dy <= 2; dy++) {
            const y = centerY + dy
            if (y < 0 || y >= height) {
              continue
            }
            for (let x = 0; x < width; x++) {
              const idx = (y * width + x) * 4
              const r = data[idx]!
              const g = data[idx + 1]!
              const b = data[idx + 2]!
              const a = data[idx + 3]!
              if (a < 128) {
                continue
              }
              const max = Math.max(r, g, b)
              const min = Math.min(r, g, b)
              const sat = max === 0 ? 0 : (max - min) / max
              if (sat > bestSaturation) {
                bestSaturation = sat
                bestR = r
                bestG = g
                bestB = b
              }
            }
          }
          return `${bestR},${bestG},${bestB}`
        }

        const rowColors = Array.from({ length: numRows }, (_, i) =>
          getDominantColorForRow(i),
        )
        console.log('[multi-row color test] Row colors:', rowColors)
        const uniqueColors = new Set(rowColors)
        if (uniqueColors.size < 2) {
          throw new Error(
            `Expected distinct colors per row but got: ${rowColors.join(' | ')}`,
          )
        }
      },
    },
  ],
}

export default suite
