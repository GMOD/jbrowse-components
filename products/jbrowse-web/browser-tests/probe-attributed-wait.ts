/* eslint-disable no-console */
// One-off probe (not a suite): what does a selector wait say when it expires?
//
//     node browser-tests/probe-attributed-wait.ts
//
// Serves no app — `setContent` is the whole fixture, so this answers in a second
// and needs no build. Two things `attributedWait.test.ts` cannot ask of jsdom:
// whether the census really crosses `page.evaluate` after the wait has already
// rejected, and whether it survives the DOM churning underneath it. The churn is
// the point — a HELD handle throws `Node is detached from document` there, which
// is how the first attempt at timeout attribution turned four diagnosable
// timeouts into nine opaque puppeteer errors and got reverted (28c6ee6d90).
//
// Read 2026-08-25, against Chrome 152:
//
//     bare  : Waiting for selector `[data-testid="maf-display"]` failed
//     census: [data-testid="maf-display"] did not appear within 1000ms —
//             1 display(s) had not painted: pileup-display (reads-x) is ready

import {
  BASE_CHROME_ARGS,
  findChromeExecutable,
  waitForSelectorAttributed,
} from '@jbrowse/browser-test-utils'
import puppeteer from 'puppeteer'

const PAGE = `
<div data-testid="pileup-display" data-display-id="reads-x"
     data-display-drawn="false" data-display-phase="loading"></div>
<div id="churn"></div>
<script>
  // re-render the census's own subject on a timer, so the report is taken while
  // the DOM is moving under it
  let n = 0
  setInterval(() => {
    const el = document.querySelector('[data-testid="pileup-display"]')
    const fresh = el.cloneNode(true)
    fresh.dataset.displayPhase = ++n % 2 ? 'loading' : 'ready'
    el.replaceWith(fresh)
  }, 50)
</script>`

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: BASE_CHROME_ARGS,
    executablePath: findChromeExecutable(),
  })
  const page = await browser.newPage()
  await page.setContent(PAGE)

  const bare = await page
    .waitForSelector('[data-testid="maf-display"]', { timeout: 1000 })
    .catch((e: unknown) => e as Error)
  console.log('bare  :', (bare as Error).message.split('\n')[0])

  const attributed = await waitForSelectorAttributed(
    page,
    '[data-testid="maf-display"]',
    1000,
  ).catch((e: unknown) => e as Error)
  console.log('census:', (attributed as Error).message)

  await page.setContent('<div data-testid="pileup-display"></div>')
  const nothingPending = await waitForSelectorAttributed(
    page,
    '[data-testid="dialog"]',
    1000,
  ).catch((e: unknown) => e as Error)
  console.log('empty :', (nothingPending as Error).message)

  const found = await waitForSelectorAttributed(
    page,
    '[data-testid="pileup-display"]',
    1000,
  )
  console.log('found :', !!found)

  await browser.close()
}

void main()
