import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const config = 'test_data/config_gfa_pangenome.json'

const sessionSpec = (trackId: string) => ({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'ref#1',
      loc: 'chr1:1-555',
      tracks: [
        {
          trackId,
          displaySnapshot: { type: 'MultiLGVSyntenyDisplay' },
        },
      ],
    },
  ],
})

const suite: TestSuite = {
  name: 'GFA Pangenome Multi-LGV Synteny',
  tests: [
    {
      name: 'GFA pangenome with precomputed aln.bed.gz shows CIGAR variants',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          sessionSpec('volvox_pangenome_gfa'),
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'gfa-pangenome-aln-cigar-canvas',
          '[data-testid="multi_synteny_canvas"]',
        )
      },
    },
    {
      name: 'GFA pangenome without aln falls back to segment-based rendering',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          sessionSpec('volvox_pangenome_gfa_no_aln'),
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await canvasSnapshot(
          page,
          'gfa-pangenome-runtime-cigar-canvas',
          '[data-testid="multi_synteny_canvas"]',
        )
      },
    },
    {
      name: 'GFA pangenome segments mode renders visible features',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          sessionSpec('volvox_pangenome_gfa_no_aln'),
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)

        // Verify the canvas has non-white pixels (features are actually drawn)
        const hasFeatures = await page.evaluate(() => {
          const canvas = document.querySelector(
            '[data-testid="multi_synteny_canvas"]',
          )!
          if (!canvas) {
            return false
          }
          const temp = document.createElement('canvas')
          temp.width = canvas.width
          temp.height = canvas.height
          const ctx = temp.getContext('2d')!
          ctx.drawImage(canvas, 0, 0)
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          for (let i = 0; i < data.length; i += 4) {
            if (data[i]! < 240 || data[i + 1]! < 240 || data[i + 2]! < 240) {
              return true
            }
          }
          return false
        })

        if (!hasFeatures) {
          throw new Error('Canvas appears blank — no features rendered')
        }
      },
    },
    {
      name: 'GFA pangenome segments mode tooltip shows on hover',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          sessionSpec('volvox_pangenome_gfa_no_aln'),
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)

        const canvas = await page.$('[data-testid="multi_synteny_canvas"]')
        const box = await canvas!.boundingBox()
        if (!box) {
          throw new Error('Could not get canvas bounding box')
        }

        // Hover over the middle of the canvas (past the label area, in a sample
        // genome row — row 0 is the ref and has no features, so use height/2)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

        await page.waitForFunction(
          () => {
            const popper = document.querySelector('.MuiTooltip-popper')
            return popper
              ? (popper as HTMLElement).style.display !== 'none' &&
                  (popper.textContent?.trim().length ?? 0) > 0
              : false
          },
          { timeout: 5000 },
        )

        const tooltipText = await page.$eval(
          '.MuiTooltip-popper',
          el => el.textContent ?? '',
        )

        if (!tooltipText.includes('Ref:') && !tooltipText.includes('Query:')) {
          throw new Error(
            `Tooltip missing coordinate info, got: "${tooltipText}"`,
          )
        }
      },
    },
    {
      name: 'GFA pangenome no console errors during segments load',
      fn: async page => {
        const errors: string[] = []
        page.on('console', msg => {
          if (msg.type() === 'error') {
            errors.push(msg.text())
          }
        })

        await navigateWithSessionSpec(
          page,
          sessionSpec('volvox_pangenome_gfa_no_aln'),
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)

        const relevant = errors.filter(
          e =>
            e.toLowerCase().includes('nan') ||
            e.toLowerCase().includes('undefined ordinal') ||
            e.toLowerCase().includes('failed to fetch'),
        )
        if (relevant.length > 0) {
          throw new Error(`Console errors during load: ${relevant.join('; ')}`)
        }
      },
    },
    {
      name: 'GFA pangenome with aln full page',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          sessionSpec('volvox_pangenome_gfa'),
          config,
        )

        await findByTestId(page, 'multi_synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await delay(2000)
        await pageSnapshot(page, 'gfa-pangenome-aln-fullpage')
      },
    },
  ],
}

export default suite
