/* eslint-disable no-console */
import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { startServer } from './server.ts'

const PORT = 3344

async function main() {
  const server = await startServer(PORT)
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  const page = await browser.newPage()

  const errors: string[] = []
  const workers: string[] = []
  page.on('pageerror', e => errors.push(`pageerror: ${e}`))
  page.on('console', m => {
    if (m.type() === 'error') {
      errors.push(`console.error: ${m.text()}`)
    }
  })
  page.on('workercreated', w => workers.push(w.url()))

  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-50000',
        tracks: ['volvox_microarray_line'],
      },
    ],
  }
  const url =
    `http://localhost:${PORT}/?config=test_data/volvox/config.json` +
    `&session=${encodeSessionSpec(spec)}&sessionName=WorkerSmoke&renderer=canvas2d`

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })

  // a *-done canvas means the worker fetched/parsed data and a render came back
  const rendered = await page
    .waitForSelector('[data-testid$="-done"]', { timeout: 45000 })
    .then(() => true)
    .catch(() => false)
  await new Promise(r => setTimeout(r, 1500))

  console.log('--- WORKER SMOKE RESULT ---')
  console.log('track display reached *-done:', rendered)
  console.log('workers created:', workers.length)
  for (const w of workers) {
    console.log('  worker url:', w)
  }
  console.log('errors:', errors.length)
  for (const e of errors.slice(0, 15)) {
    console.log('  ', e)
  }

  await browser.close()
  server.close()
  const ok = rendered && workers.length > 0 && errors.length === 0
  console.log(
    ok ? '\nPASS: worker booted + track rendered, no errors' : '\nFAIL',
  )
  process.exit(ok ? 0 : 1)
}

void main()
