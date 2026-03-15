import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Wiggle Color Change',
  tests: [
    {
      name: 'wiggle track updates color after user changes it',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
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
          'wiggle-color-before',
          '[data-testid="wiggle-display"] canvas',
        )

        // Open track menu
        const menuIcon = await findByTestId(page, 'track_menu_icon', 10000)
        await menuIcon?.click()
        await delay(300)

        // Click "Color" menu item
        const colorItem = await findByText(page, 'Color', 10000)
        await colorItem?.click()
        await delay(500)

        // Type a new color into the manual color text field
        // The dialog has a TextField with helperText about manual color entry
        const colorInput = await page.waitForSelector(
          'input[aria-describedby]',
          { timeout: 10000 },
        )
        await colorInput?.click({ clickCount: 3 })
        await colorInput?.type('red')
        await delay(1500)

        // Click Submit button to close dialog
        const submitBtn = await page.waitForSelector('button[type="submit"]', {
          timeout: 10000,
        })
        await submitBtn?.click()
        await delay(1000)

        await waitForCanvasRendered(
          page,
          '[data-testid="wiggle-display"] canvas',
        )
        await canvasSnapshot(
          page,
          'wiggle-color-after-red',
          '[data-testid="wiggle-display"] canvas',
        )
      },
    },
  ],
}

export default suite
