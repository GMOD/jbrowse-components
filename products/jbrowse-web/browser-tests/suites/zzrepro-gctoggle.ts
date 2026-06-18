import { navigateToApp, openTrack } from '../helpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'ZZRepro GC Toggle',
  tests: [
    {
      name: 'toggle gc content track on/off/on',
      fn: async page => {
        page.on('console', msg => {
          console.log('PAGE LOG:', msg.type(), msg.text())
        })
        page.on('pageerror', err => {
          console.log('PAGE ERROR:', err.message)
        })
        await navigateToApp(page)
        await new Promise(r => setTimeout(r, 2000))
        const html = await page.content()
        console.log('htsTrackLabel count:', (html.match(/htsTrackLabel/g) ?? []).length)
        console.log('volvox_gc in html:', html.includes('volvox_gc'))
        console.log('Opening track for the first time...')
        await openTrack(page, 'volvox_gc')
        await page.waitForSelector('[data-testid^="display-volvox_gc"]', {
          timeout: 15000,
        })
        await new Promise(r => setTimeout(r, 3000))
        const loadingPresent1 = await page.evaluate(() =>
          document.body.textContent?.includes('Loading'),
        )
        console.log('After first toggle on, Loading text present:', loadingPresent1)
        const hasDoneTestId1 = await page.evaluate(
          () => !!document.querySelector('[data-testid="wiggle-display-done"]'),
        )
        console.log('wiggle-display-done present:', hasDoneTestId1)

        console.log('Toggling track off...')
        await openTrack(page, 'volvox_gc')
        await new Promise(r => setTimeout(r, 1000))

        console.log('Toggling track back on...')
        await openTrack(page, 'volvox_gc')
        await page.waitForSelector('[data-testid^="display-volvox_gc"]', {
          timeout: 15000,
        })
        await new Promise(r => setTimeout(r, 5000))
        const loadingPresent2 = await page.evaluate(() =>
          document.body.textContent?.includes('Loading'),
        )
        const loadingOverlayPresent2 = await page.evaluate(
          () => !!document.querySelector('[data-testid="loading-overlay"]'),
        )
        const hasDoneTestId2 = await page.evaluate(
          () => !!document.querySelector('[data-testid="wiggle-display-done"]'),
        )
        console.log('After re-toggle on, Loading text present:', loadingPresent2)
        console.log('loading-overlay element present:', loadingOverlayPresent2)
        console.log('wiggle-display-done present:', hasDoneTestId2)

        if (loadingOverlayPresent2) {
          throw new Error('REPRO: track stuck on loading-overlay after retoggle')
        }
      },
    },
  ],
}

export default suite
