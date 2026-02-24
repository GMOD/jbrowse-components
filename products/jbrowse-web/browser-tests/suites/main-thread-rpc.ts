import {
  findByTestId,
  findByText,
  navigateToApp,
  openTrack,
  waitForCanvasRendered,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'MainThreadRPC',
  tests: [
    {
      name: 'loads with main thread RPC',
      fn: async page => {
        await navigateToApp(page, 'test_data/volvox/config_main_thread.json')
        await findByText(page, 'Help', 10000)
      },
    },
    {
      name: 'loads BAM track with main thread RPC',
      fn: async page => {
        await navigateToApp(page, 'test_data/volvox/config_main_thread.json')
        await openTrack(page, 'volvox_sv')
        await findByTestId(page, 'pileup-display', 60000)
      },
    },
    {
      name: 'loads GFF3 track with main thread RPC',
      fn: async page => {
        await navigateToApp(page, 'test_data/volvox/config_main_thread.json')
        await openTrack(page, 'gff3tabix_genes')
        await page.waitForSelector('[data-testid^="display-gff3tabix_genes"]', {
          timeout: 120000,
        })
      },
    },
    {
      name: 'main thread RPC BAM screenshot',
      fn: async page => {
        await navigateToApp(page, 'test_data/volvox/config_main_thread.json')
        await openTrack(page, 'volvox_sv')
        await findByTestId(page, 'pileup-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(page, '[data-testid="pileup-display"] canvas')
        await canvasSnapshot(
          page,
          'main-thread-rpc-bam-canvas',
          '[data-testid="pileup-display"] canvas',
        )
      },
    },
  ],
}

export default suite
