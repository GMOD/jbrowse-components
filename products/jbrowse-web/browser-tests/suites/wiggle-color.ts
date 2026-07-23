import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'

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

        await findByTestId(page, 'wiggle-display-done', 60000)
        await waitForDataLoaded(page)

        const menuIcon = await findByTestId(page, 'track_menu_icon', 10000)
        await menuIcon?.click()
        await delay(300)

        // renamed from "Color" in 569af0a120; findByText is case-sensitive
        const colorItem = await findByText(page, 'Edit color...', 10000)
        await colorItem?.click()
        await delay(500)

        // the dialog shows compact swatches; the hex field lives in the
        // popover each swatch opens (default mode is bicolor, so this is the
        // positive color)
        const swatch = await findByTestId(page, 'wiggle-pos-color', 10000)
        await swatch?.click()
        await delay(300)

        const colorInput = await page.waitForSelector(
          '.MuiPopover-root input[aria-describedby]',
          { timeout: 10000 },
        )
        await colorInput?.click({ count: 3 })
        await colorInput?.type('red')
        await delay(1500)

        // dismiss the popover so its backdrop doesn't swallow the submit click
        await page.keyboard.press('Escape')
        await delay(300)

        const submitBtn = await page.waitForSelector('button[type="submit"]', {
          timeout: 10000,
        })
        await submitBtn?.click()
        await delay(1000)

        await dualSnapshot(
          page,
          'wiggle-color-after-red',
          '[data-testid="wiggle-display-done"] canvas',
        )
      },
    },
  ],
}

export default suite
