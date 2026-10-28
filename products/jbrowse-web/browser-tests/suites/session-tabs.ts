import {
  delay,
  findByText,
  navigateToApp,
  navigateToUrl,
  zoomOut,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Browser, Page } from 'puppeteer'

/**
 * Which tab owns a session id (sessionLock.ts). Two tabs on one id overwrite
 * one IndexedDB row every autosave tick, so a tab adopting an id that another
 * live tab holds has to fork; one adopting an id nobody holds, a reload above
 * all, has to keep it.
 */

async function sessionId(page: Page) {
  await page.waitForFunction(
    () => window.location.search.includes('session=local-'),
    { timeout: 20000 },
  )
  return page.evaluate(() =>
    new URLSearchParams(window.location.search).get('session')!,
  )
}

async function openTab(browser: Browser, query: string, sessionStorage = '') {
  const page = await browser.newPage()
  if (sessionStorage) {
    // what a browser's "Duplicate tab" does: the new tab starts with a copy of
    // the old one's sessionStorage
    await page.evaluateOnNewDocument((current: string) => {
      if (!window.sessionStorage.getItem('current')) {
        window.sessionStorage.setItem('current', current)
      }
    }, sessionStorage)
  }
  await navigateToUrl(page, query)
  await findByText(page, 'ctgA')
  return page
}

const config = 'config=test_data/volvox/config.json'

const suite: TestSuite = {
  name: 'Session tabs',
  tests: [
    {
      name: 'a reload keeps its session id',
      fn: async page => {
        await navigateToApp(page, 'test_data/volvox/config.json', 'Reloaded')
        const before = await sessionId(page)
        await delay(1000)
        await page.reload({ timeout: 60000 })
        await findByText(page, 'ctgA')
        const after = await sessionId(page)
        if (after !== before) {
          throw new Error(`reload forked ${before} into ${after}`)
        }
      },
    },
    {
      name: 'a second tab forks an id the first still holds, and keeps it once closed',
      fn: async (page, browser) => {
        await navigateToApp(page, 'test_data/volvox/config.json', 'Shared')
        const id = await sessionId(page)
        // let the first autosave land, so the second tab finds the row
        await delay(1500)
        const copied = await openTab(browser!, `${config}&session=${id}`)
        const copiedId = await sessionId(copied)
        await copied.close()
        if (copiedId === id) {
          throw new Error(`a second tab on ${id} kept the id the first holds`)
        }

        const current = await page.evaluate(() =>
          window.sessionStorage.getItem('current'),
        )
        const duplicate = await openTab(
          browser!,
          `${config}&session=${id}`,
          current ?? '',
        )
        const duplicateId = await sessionId(duplicate)
        await duplicate.close()
        if (duplicateId === id) {
          throw new Error(
            `a duplicated tab kept the id ${id} its original holds`,
          )
        }

        // the original goes, so the id is free: a bookmark of it continues the
        // session rather than adding a copy to the recent list
        await page.goto('about:blank')
        await delay(500)
        const reopened = await openTab(browser!, `${config}&session=${id}`)
        const reopenedId = await sessionId(reopened)
        await reopened.close()
        if (reopenedId !== id) {
          throw new Error(
            `reopening ${id} with no tab holding it forked ${reopenedId}`,
          )
        }
      },
    },
    {
      name: 'an untouched session stays out of Recent sessions',
      fn: async page => {
        const volvox = 'test_data/volvox/config.json'
        await navigateToApp(page, volvox, 'Edited one')
        await delay(1200)
        await zoomOut(page)
        await delay(1200)
        await navigateToApp(page, volvox, 'Untouched one')
        await delay(2000)
        await navigateToApp(page, volvox, 'Looking')
        await delay(1200)
        await (await findByText(page, 'File')).click()
        await delay(400)
        await (await findByText(page, 'Recent sessions...')).click()
        await findByText(page, 'Edited one')
        const rows = await page.evaluate(() =>
          [...document.querySelectorAll('.MuiDataGrid-row')].map(
            e => e.textContent,
          ),
        )
        if (rows.some(t => t.includes('Untouched one'))) {
          throw new Error(`untouched session listed in ${JSON.stringify(rows)}`)
        }
      },
    },
  ],
}

export default suite
