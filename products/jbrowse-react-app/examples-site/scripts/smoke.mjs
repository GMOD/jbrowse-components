// Build-output smoke test (run after `astro build`): node scripts/smoke.mjs
// Shared implementation lives in @jbrowse/browser-test-utils so all the
// per-product examples-site smoke scripts stay identical; the per-page `check`
// hooks below are this site's own.
import path from 'path'
import { fileURLToPath } from 'url'

import { smokeExamplesSite } from '@jbrowse/browser-test-utils'

import config from '../astro.config.mjs'
import { examples } from '../src/examples.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

// The plugins page loads jbrowse-plugin-ucsc at runtime and opens a track whose
// adapter only that plugin provides. If the bundle fetch fails (unpkg down, no
// network) nothing here fires — that's an environment problem, already filtered
// as network noise. But if the bundle DID load and the app still can't resolve
// UCSCAdapter, our wiring dropped the plugin on the way into the PluginManager,
// which a load-only check can't see: the page renders, the track just errors.
async function checkPluginTookEffect(page) {
  // the UMD bundle assigns this global as it evaluates
  const loaded = await page.evaluate(() => 'JBrowsePluginUCSC' in window)
  if (!loaded) {
    return []
  }
  const text = await page.evaluate(() => document.body.innerText)
  return /unknown (adapter|track) type/i.test(text)
    ? ['plugin bundle loaded but the app did not register its types']
    : []
}

// Drive the session-in-url demo's actual round trip: save the live session into
// the URL, reload, and confirm the app came back up from it. Both halves are
// browser-only (deflate + base64 out, the hash read + restore back in), so a
// unit test can't stand in for this one.
async function checkSessionUrlRoundTrip(page) {
  // scoped to .demo: the doc prose above it renders code blocks that carry
  // their own copy buttons
  const button = await page.$('#session-in-url .demo button')
  if (!button) {
    return ['session-in-url: save button not rendered']
  }
  await button.click()
  const saved = await page
    .waitForFunction(() => window.location.hash.includes('session=encoded-'), {
      timeout: 10000,
    })
    .then(() => true)
    .catch(() => false)
  if (!saved) {
    const hash = await page.evaluate(() => window.location.hash)
    return [`session-in-url: save did not write a session to the url (${hash})`]
  }
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  return page
    .waitForFunction(
      () =>
        document
          .querySelector('#session-in-url .demo')
          ?.textContent?.includes('restored "'),
      { timeout: 30000 },
    )
    .then(() => [])
    .catch(() => ['session-in-url: the session in the url did not restore'])
}

const checks = {
  plugins: checkPluginTookEffect,
  'customizing-the-app': checkSessionUrlRoundTrip,
}

const failures = await smokeExamplesSite({
  distDir: path.join(here, '..', 'dist'),
  // single source of truth for the base path is astro.config.mjs
  base: config.base,
  slugs: examples.map(e => e.slug),
  // the web-worker example (a section on the customizing-the-app page) must
  // actually spawn an RPC worker — guards the Rollup circular-dependency TDZ
  // that webpack tolerates.
  workerSlug: 'customizing-the-app',
  check: (page, slug) => checks[slug]?.(page) ?? [],
  log: m => {
    console.log(m)
  },
})
process.exit(failures ? 1 : 0)
