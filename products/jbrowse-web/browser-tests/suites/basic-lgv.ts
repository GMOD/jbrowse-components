import {
  delay,
  findByTestId,
  findByText,
  navigateToApp,
  openTrack,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'BasicLinearGenomeView',
  tests: [
    {
      name: 'loads the application',
      fn: async page => {
        await navigateToApp(page)
        await findByText(page, 'Help', 10000)
      },
    },
    {
      name: 'opens track selector and loads a track',
      fn: async page => {
        await navigateToApp(page)
        await openTrack(page, 'volvox_refseq')
        await findByTestId(
          page,
          'display-volvox_refseq-LinearReferenceSequenceDisplay',
        )
      },
    },
    {
      name: 'can zoom in and out',
      fn: async page => {
        await navigateToApp(page)
        const zoomIn = await findByTestId(page, 'zoom_in', 10000)
        await zoomIn?.click()
        await delay(500)
        const zoomOut = await findByTestId(page, 'zoom_out', 10000)
        await zoomOut?.click()
      },
    },
    {
      name: 'can access About dialog',
      fn: async page => {
        await navigateToApp(page)
        const helpButton = await findByText(page, 'Help', 10000)
        await helpButton?.click()
        await delay(300)
        const aboutMenuItem = await findByText(page, 'About', 10000)
        await aboutMenuItem?.click()
        await findByText(page, /The Evolutionary Software Foundation/i, 10000)
      },
    },
    {
      name: 'can search for a location',
      fn: async page => {
        await navigateToApp(page)
        const searchInput = await page.waitForSelector(
          'input[placeholder="Search for location"]',
          { timeout: 30000 },
        )
        await searchInput?.click()
        await searchInput?.type('ctgA:1000..2000')
        await page.keyboard.press('Enter')
        await delay(1000)
      },
    },
  ],
}

export default suite
