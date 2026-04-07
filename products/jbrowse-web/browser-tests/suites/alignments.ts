import {
  delay,
  findByTestId,
  navigateToApp,
  navigateWithSessionSpec,
  openTrack,
  waitForDataLoaded
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Alignments Track',
  tests: [
    {
      name: 'loads BAM track',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_alignments')
        await findByTestId(page, 'pileup-display-done', 60000)
      }
},
    {
      name: 'loads CRAM track',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_cram_alignments')
        await findByTestId(page, 'pileup-display-done', 60000)
      }
},
    {
      name: 'BAM track screenshot',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_alignments')
        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'alignments-bam-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      }
},
    {
      name: 'volvox_sv track screenshot',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:2,707..48,600',
              tracks: ['volvox_sv']
},
          ]
})

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'alignments-volvox-sv-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      }
},
    {
      name: 'volvox long reads with SV (zoomed out)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1..50,001',
              tracks: ['volvox-long-reads-sv-bam']
},
          ]
})

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'alignments-long-reads-sv-zoomed-out-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      }
},
    {
      name: 'pileup + coverage track',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_alignments_pileup_coverage']
},
          ]
})

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'alignments-pileup-coverage-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      }
},
    {
      name: 'read vs ref context menu appears',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:500-700',
              tracks: ['volvox_alignments_pileup_coverage']
},
          ]
})

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await delay(1000)

        const canvas = await page.$('[data-testid="pileup-display-done"] canvas')
        if (!canvas) {
          throw new Error('Pileup canvas not found')
        }
        const box = await canvas.boundingBox()
        if (!box) {
          throw new Error('Canvas bounding box not found')
        }

        // Right-click at 30% height (in the dense pileup area, below coverage)
        // At ctgA:500-700 zoomed in, this reliably hits a read
        const clickX = box.x + box.width * 0.5
        const clickY = box.y + box.height * 0.3
        await page.mouse.click(clickX, clickY, { button: 'right' })
        await delay(500)

        // Verify "Linear read vs ref" appears in the context menu
        const items = await page.evaluate(() =>
          Array.from(document.querySelectorAll('[role="menuitem"]')).map(
            m => m.textContent,
          ),
        )
        if (!items.includes('Linear read vs ref')) {
          throw new Error(
            `"Linear read vs ref" not in context menu. Got: ${items.join(', ')}`,
          )
        }
      }
},
    {
      name: 'sub-pixel mismatch blending with coverage (zoomed out)',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1..10,000',
              tracks: ['volvox_alignments_pileup_coverage']
},
          ]
})

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        // Verify no white spots from disabled blending: coverage renderer
        // disables gl.BLEND after indicator draw; pileup renderer must
        // re-enable it so sub-pixel mismatches alpha-blend with reads
        // rather than replacing them with near-transparent pixels
        await canvasSnapshot(
          page,
          'alignments-subpixel-mismatch-blend-canvas',
          '[data-testid="pileup-display-done"] canvas',
        )
      }
},
  ]
}

export default suite
