import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  delay,
  findByTestId,
  findByText,
  findDisplayPainted,
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

        await findDisplayPainted(page, 'wiggle-display', 60000)
        await waitForDataLoaded(page)

        const menuIcon = await findByTestId(page, 'track_menu_icon', 10000)
        await menuIcon.click()
        await delay(300)

        const colorItem = await findByText(
          page,
          'Edit colors/arrangement...',
          10000,
        )
        await colorItem.click()
        await delay(500)

        // the two swatches say a constant and a cut; a ramp or several cuts is
        // the plot box behind the same dialog
        const plotItem = await findByText(page, 'Edit plot...', 10000)
        await plotItem.click()
        await delay(500)

        // the color is one object written as JSON; a string is the constant
        const plotField = await findByTestId(page, 'plot-json', 10000)
        await plotField.click({ count: 3 })
        await page.keyboard.down('Control')
        await page.keyboard.press('KeyA')
        await page.keyboard.up('Control')
        await plotField.type('{"color": "red"}')
        await delay(500)

        const submitBtn = await page.waitForSelector('button[type="submit"]', {
          timeout: 10000,
        })
        await submitBtn?.click()
        await delay(1000)

        await dualSnapshot(
          page,
          'wiggle-color-after-red',
          `${displayPainted('wiggle-display')} canvas`,
        )
      },
    },
  ],
}

export default suite
