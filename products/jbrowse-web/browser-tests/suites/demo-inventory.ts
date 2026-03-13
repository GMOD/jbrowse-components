import {
  appendGpuParam,
  delay,
  findByText,
  PORT,
  waitForDataLoaded,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

async function loadDemoAndCheck(
  page: Page,
  config: string,
  waitForText?: string,
) {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (!text.includes('favicon') && !text.includes('404')) {
        errors.push(text)
      }
    }
  })

  const url = appendGpuParam(
    `http://localhost:${PORT}/?config=${config}&sessionName=Demo%20Test`,
  )
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })

  if (waitForText) {
    await findByText(page, waitForText, 30000)
  }

  await delay(2000)

  const hasErrorOverlay = await page.evaluate(
    () => document.querySelector('[data-testid="error-overlay"]') !== null,
  )
  if (hasErrorOverlay) {
    throw new Error('Error overlay visible on page')
  }

  const fatalErrors = errors.filter(
    e =>
      e.includes('Uncaught') ||
      e.includes('TypeError') ||
      e.includes('ReferenceError'),
  )
  if (fatalErrors.length > 0) {
    throw new Error(`Fatal console errors: ${fatalErrors.join('; ')}`)
  }
}

const localDemos: TestSuite = {
  name: 'Demo Inventory (Local)',
  tests: [
    {
      name: 'Volvox demo loads',
      fn: async page => {
        await loadDemoAndCheck(
          page,
          'test_data/volvox/config.json',
          'ctgA',
        )
      },
    },
    {
      name: 'SARS-CoV2 demo loads',
      fn: async page => {
        await loadDemoAndCheck(page, 'test_data/sars-cov2/config.json')
      },
    },
    {
      name: 'Breakpoint split view demo loads',
      fn: async page => {
        await loadDemoAndCheck(page, 'test_data/breakpoint/config.json')
      },
    },
    {
      name: 'Dotplot demo loads',
      fn: async page => {
        await loadDemoAndCheck(page, 'test_data/config_dotplot.json')
      },
    },
    {
      name: 'Yeast synteny demo loads',
      fn: async page => {
        await loadDemoAndCheck(
          page,
          'test_data/yeast_synteny/config.json',
        )
      },
    },
    {
      name: 'Hi-C demo loads',
      fn: async page => {
        await loadDemoAndCheck(
          page,
          'extra_test_data/hic_integration_test.json',
        )
      },
    },
    {
      name: 'Volvox demo has rendered canvas',
      fn: async page => {
        const url = appendGpuParam(
          `http://localhost:${PORT}/?config=test_data/volvox/config.json&session=spec-${encodeURIComponent(JSON.stringify({ views: [{ type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-10000', tracks: ['volvox_filtered_vcf'] }] }))}&sessionName=Demo%20Test`,
        )
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
        await findByText(page, 'ctgA')
        await waitForDataLoaded(page)

        const hasCanvas = await page.evaluate(() => {
          const canvases = document.querySelectorAll(
            '[data-testid^="display-"] canvas',
          )
          for (const c of canvases) {
            const canvas = c as HTMLCanvasElement
            if (canvas.width > 0 && canvas.height > 0) {
              return true
            }
          }
          return false
        })
        if (!hasCanvas) {
          throw new Error('No rendered canvas found with non-zero dimensions')
        }
      },
    },
  ],
}

export default localDemos
