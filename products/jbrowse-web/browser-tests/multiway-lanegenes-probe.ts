/* eslint-disable no-console */
// One-off probe: does the MultiWaySyntenyDisplay lane-genes fetch commit
// against the hosted grape demo in a real build (web worker RPC)? Captures the
// page console, which the screenshot generator and jest both hide.
//
//   node products/jbrowse-web/browser-tests/multiway-lanegenes-probe.ts
import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { delay, setPort } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)

const browser = await launch({
  headless: true,
  executablePath: findChromeExecutable(),
  protocolTimeout: 1200000,
  args: [
    ...BASE_CHROME_ARGS,
    '--enable-unsafe-swiftshader',
    '--window-size=1280,800',
  ],
  defaultViewport: { width: 1280, height: 800 },
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1500, height: 680, deviceScaleFactor: 2 })
  await page.evaluateOnNewDocument(() => {
    const install = () => {
      const style = document.createElement('style')
      style.textContent =
        '*,*::before,*::after{transition:none !important;animation:none !important;}'
      document.head.append(style)
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (document.head) {
      install()
    } else {
      document.addEventListener('DOMContentLoaded', install)
    }
  })
  page.on('console', msg => {
    const text = msg.text()
    if (msg.type() === 'error' || text.includes('MultiWay')) {
      console.log(
        `${Date.now() % 100000} CONSOLE[${msg.type()}]: ${text.slice(0, 300)}`,
      )
    }
  })
  page.on('pageerror', e => {
    console.log(`PAGE ERROR: ${e instanceof Error ? e.stack : String(e)}`)
  })
  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'grape',
        loc: '11:828,000-866,000',
        tracks: [
          {
            trackId: 'grape_genes',
            type: 'LinearBasicDisplay',
            showOnlyGenes: true,
            displayMode: 'compact',
            showLabels: 'auto',
          },
          {
            trackId: 'grape_peach_cacao_blocks',
            type: 'MultiWaySyntenyDisplay',
            rowOrder: [
              'peach',
              'cacao',
              'poplar',
              'citrus',
              'arabidopsis',
              'tomato',
            ],
            height: 340,
          },
        ],
      },
    ],
  }
  const url = `http://localhost:${port}/?config=${encodeURIComponent('https://jbrowse.org/demos/grape_peach_cacao/config.json')}&session=${encodeSessionSpec(spec)}&sessionName=Screenshot&renderer=webgl`
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 90000 })
  await delay(25000)
  const state = await page.evaluate(() => {
    const display = document.querySelector(
      '[data-testid="multiway-synteny-display"]',
    )
    return {
      rects: display?.querySelectorAll('rect').length,
      lines: display?.querySelectorAll('line').length,
      geneGlyphs: display?.querySelectorAll('g').length,
      lanesCurrent: display?.querySelector('svg')?.dataset.lanesCurrent,
      labels: [...(display?.querySelectorAll('text') ?? [])].map(
        t => t.textContent,
      ),
    }
  })
  console.log(JSON.stringify(state, null, 2))
} finally {
  await browser.close()
  server.close()
}
