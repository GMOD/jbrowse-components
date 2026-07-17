import { findByTestId, navigateToUrl, waitForDataLoaded } from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Dotplot View',
  tests: [
    {
      // A synteny track is queryable in either direction, so the axes Quick
      // start derives are a starting point, not a fact about the track. Swap
      // flips them, and the choice has to survive the handoff into Manual —
      // otherwise switching modes silently discards the user's orientation.
      name: 'import form quick start swaps axes and carries them into Manual',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/config_dotplot.json')
        const add = await page.waitForSelector('::-p-text(Add)', {
          timeout: 30000,
        })
        await add!.click()
        const dotplot = await page.waitForSelector('::-p-text(Dotplot view)')
        await dotplot!.click()

        const axes = await findByTestId(page, 'quick-start-axes', 30000)
        const before = await axes!.evaluate(e => e.textContent)

        const swap = await page.waitForSelector('::-p-text(Swap)')
        await swap!.click()
        const after = await page.waitForFunction(
          (prev: string) => {
            const el = document.querySelector(
              '[data-testid="quick-start-axes"]',
            )
            const text = el?.textContent
            return text && text !== prev ? text : undefined
          },
          { timeout: 10000 },
          before,
        )
        const swapped = (await after.jsonValue()) ?? ''
        // grape/peach either way round; the point is the two axes exchanged
        if (
          !before.includes('X-axis: grape') ||
          !swapped.includes('X-axis: peach')
        ) {
          throw new Error(`swap did not exchange axes: ${before} -> ${swapped}`)
        }

        const manual = await page.waitForSelector('::-p-text(Manual)')
        await manual!.click()
        await page.waitForSelector('::-p-text(Select assemblies for dotplot)')
        const values = await page.$$eval('.MuiSelect-select', els =>
          els.map(e => e.textContent),
        )
        // x-axis selector renders first, so the swapped x (peach) leads
        if (values[0] !== 'peach' || values[1] !== 'grape') {
          throw new Error(
            `Manual lost the swapped axes: ${JSON.stringify(values)}`,
          )
        }
      },
    },
    {
      name: 'dotplot default session',
      fn: async page => {
        await navigateToUrl(
          page,
          'config=test_data/config_dotplot.json&sessionName=Test%20Session',
        )

        await page.waitForSelector(
          '[data-testid="dotplot_webgl_canvas_done"]',
          {
            timeout: 60000,
          },
        )
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'dotplot-default-canvas',
          '[data-testid="dotplot_webgl_canvas_done"]',
        )
      },
    },
  ],
}

export default suite
