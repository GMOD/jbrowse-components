/* eslint-disable no-console */
// One-off probe (not a suite): does the app bar still work after 34fae70aa1
// moved the session binding out of the menu data and into onMenuItemClick?
// Nothing in the repo drives an app-bar menu end to end, so this is the check
// the unit test cannot make — a real bundle, a real click, a real view opened.
//
//   node products/jbrowse-web/browser-tests/appbar-menu-probe.ts
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { findByText, navigateToApp, setPort } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 },
})

const countViews = (page: Page) =>
  page.evaluate(
    () => document.querySelectorAll('[data-testid^="view-container-"]').length,
  )

try {
  const page = await browser.newPage()
  page.on('pageerror', e => {
    console.log(`PAGE ERROR: ${e.message}`)
  })
  await navigateToApp(page)

  const before = await countViews(page)
  console.log(`views before: ${before}`)

  // Add > Linear genome view. The item's onClick is `session => session.addView(…)`,
  // so it throws unless the session reached it through onMenuItemClick.
  await (await findByText(page, 'Add')).click()
  await (await findByText(page, 'Linear genome view')).click()

  await page.waitForFunction(
    (n: number) =>
      document.querySelectorAll('[data-testid^="view-container-"]').length > n,
    { timeout: 15000 },
    before,
  )
  console.log(`views after Add > Linear genome view: ${await countViews(page)}`)

  // a sub-menu, since the binding has to survive the extra depth too. Help >
  // About opens a drawer widget rather than a view.
  await (await findByText(page, 'Help')).click()
  await (await findByText(page, 'About')).click()
  await findByText(page, /JBrowse 2/)
  console.log('Help > About opened the about widget')

  console.log('OK: the app bar binds the session at both depths')
} finally {
  await browser.close()
  server.close()
}
