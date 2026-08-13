import {
  findByTestId,
  findByText,
  navigateToApp,
  openTrack,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// The teardown a plugin install drives, in a real browser.
//
// jest covers this too (tests/rootModelTeardown.test.tsx) and cannot cover all
// of it: the React render-logging that reads the outgoing props is a
// development-build mechanism, absent from the production bundle these tests
// load, so jsdom is where that half is pinned. What only a browser can say is
// whether the app still WORKS after a reload, which is what this adds — and it
// earned its place on the way in, by catching a reload that left the shell
// perfectly healthy and every track 404ing.
//
// Not covered here, and worth knowing before trying: the superseded root's web
// worker pool. page.workers() and browser.targets() both report none of
// jbrowse's workers, so an assertion built on either passes whatever the app
// does, and wrapping window.Worker via evaluateOnNewDocument shows zero created
// on this path — the volvox tracks these tests open do not reach a worker in
// this harness. See agent-docs/TODO.md.

// Installing a plugin flips pluginsUpdated, and the autosave autorun turns that
// into the reloadPluginManagerCallback that rebuilds the app. Driving it off
// the model rather than clicking through the plugin store keeps this off the
// network and off the store's UI while still taking the real path, with the
// real config and session snapshots.
async function triggerPluginReload(page: Page) {
  await page.evaluate(() => {
    ;(window as unknown as Record<string, unknown>).__oldRoot =
      window.JBrowseRootModel
    ;(
      window.JBrowseRootModel as { setPluginsUpdated: () => void }
    ).setPluginsUpdated()
  })
  // the autosave autorun that reads pluginsUpdated is delayed 400ms
  await page.waitForFunction(
    () =>
      window.JBrowseRootModel !==
      (window as unknown as Record<string, unknown>).__oldRoot,
    { timeout: 30000 },
  )
  // the replacement has to finish coming up, or the caller asserts on a flush
  // that has not happened yet
  await findByText(page, 'ctgA', 30000)
}

const suite: TestSuite = {
  name: 'PluginReload',
  tests: [
    {
      // The superseded root used to be destroyed while React still held its
      // views and widgets in the outgoing props, so anything reading them read
      // a dead node. MST reports that as a liveliness warning and, on a child
      // node it never materialized, as a hard throw that takes the page down.
      // Both are asserted, because which one a user gets is decided by what
      // they had open rather than by anything in the code.
      //
      // The track is reopened afterwards rather than just checking the shell
      // came back. A reload that hands the replacement a config whose relative
      // uris no longer resolve leaves the shell healthy and every track 404ing,
      // and "ctgA is on screen" cannot tell the difference — which is exactly
      // what this test found while being written.
      name: 'a plugin reload leaves the app working and reads no dead nodes',
      fn: async page => {
        const deadReads: string[] = []
        const pageErrors: string[] = []
        const notFound: string[] = []
        page.on('console', msg => {
          const text = msg.text()
          if (
            text.includes('no longer part of a state tree') ||
            text.includes('must be done on the initializing phase')
          ) {
            deadReads.push(text.split('\n')[0]!)
          }
        })
        page.on('pageerror', (err: unknown) => {
          pageErrors.push(`${err}`.split('\n')[0]!)
        })
        page.on('response', res => {
          if (res.status() === 404) {
            notFound.push(res.url())
          }
        })

        await navigateToApp(page)
        await openTrack(page, 'volvox_alignments')
        await findByTestId(page, 'pileup-display', 60000)

        await triggerPluginReload(page)
        await findByTestId(page, 'pileup-display', 60000)

        if (deadReads.length) {
          throw new Error(
            `read ${deadReads.length} dead node(s) across the reload:\n  ${deadReads.join('\n  ')}`,
          )
        }
        if (pageErrors.length) {
          throw new Error(
            `${pageErrors.length} uncaught page error(s) across the reload:\n  ${pageErrors.join('\n  ')}`,
          )
        }
        if (notFound.length) {
          throw new Error(
            `${notFound.length} request(s) 404ed across the reload, which is what a dropped config baseUri looks like:\n  ${[...new Set(notFound)].join('\n  ')}`,
          )
        }
      },
    },
  ],
}

export default suite
