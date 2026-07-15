// Throwaway: attribute DOM mutations during an alignments zoom to their nearest
// identifiable subtree, to find what actually re-renders per frame. Zero source
// changes, runs the built bundle. Headed = real GPU (no swiftshader stall).
//   node --experimental-strip-types scripts/measure-zoom-churn.ts [--headed]
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
  waitForLoadingComplete,
  waitForQuiescent,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { delay, textSelector, waitForVisible } from './actions.ts'
import { VOLVOX, lgvSession } from './screenshot-spec-helpers.ts'

import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const headed = process.argv.includes('--headed')
const PORT = 3336
const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 1 }

async function startObserver(page: Page) {
  await page.evaluate(() => {
    const counts = new Map<string, number>()
    const labelFor = (node: Node) => {
      let el: HTMLElement | null =
        node.nodeType === 1 ? (node as HTMLElement) : node.parentElement
      for (let i = 0; el && i < 12; i++) {
        const testid = el.dataset.testid
        if (testid) {
          return `testid:${testid}`
        }
        el = el.parentElement
      }
      // fall back to the tag + first class of the direct parent
      const p = node.parentElement
      return p
        ? `${p.tagName.toLowerCase()}.${(p.className || '').toString().split(' ')[0]}`
        : node.nodeName
    }
    const obs = new MutationObserver(records => {
      for (const r of records) {
        const struct = r.addedNodes.length + r.removedNodes.length
        const kind = r.type === 'attributes' ? 'attr' : 'struct'
        const key = `${kind}  ${labelFor(r.target)}`
        counts.set(key, (counts.get(key) ?? 0) + (struct || 1))
      }
    })
    obs.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
    ;(
      window as unknown as { __churn: { counts: Map<string, number> } }
    ).__churn = { counts }
    ;(window as unknown as { __churnObs: MutationObserver }).__churnObs = obs
  })
}

async function stopAndDump(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      __churn: { counts: Map<string, number> }
      __churnObs: MutationObserver
    }
    w.__churnObs.disconnect()
    return [...w.__churn.counts.entries()].sort((a, b) => b[1] - a[1])
  })
}

async function zoomClicks(page: Page, times: number) {
  for (let i = 0; i < times; i++) {
    const btn = await page.$('[data-testid="zoom_in"]')
    await btn?.click()
    await delay(900)
  }
}

async function main() {
  const server = await createTestServer(PORT, {
    jbrowseWebRoot: testDataRoot,
    repoRoot,
  })
  const browser = await launch({
    headless: !headed,
    defaultViewport: VIEWPORT,
    executablePath: findChromeExecutable(),
    args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
  })
  try {
    const page = await browser.newPage()
    const url = lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-20,000',
      tracks: ['volvox_cram_alignments'],
    })
    await page.goto(`http://localhost:${PORT}/${url}`, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    })
    await waitForVisible(page, textSelector('ctgA'))
    await waitForLoadingComplete(page, { waitForDownloads: true })
    await waitForQuiescent(page)
    await delay(1500)

    await startObserver(page)
    await zoomClicks(page, 5)
    await delay(500)
    const dump = await stopAndDump(page)

    process.stderr.write('\n=== DOM mutations during 5× zoom, by subtree ===\n')
    let total = 0
    for (const [, n] of dump) {
      total += n
    }
    for (const [k, n] of dump.slice(0, 30)) {
      process.stderr.write(`${String(n).padStart(6)}  ${k}\n`)
    }
    process.stderr.write(`total mutations: ${total}\n`)
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
