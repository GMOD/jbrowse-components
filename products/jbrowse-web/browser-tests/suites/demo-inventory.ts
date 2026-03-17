import {
  appendGpuParam,
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  PORT,
  waitForCanvasRendered,
  waitForDataLoaded,
} from '../helpers.ts'
import { canvasSnapshot, pageSnapshot } from '../snapshot.ts'

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
    // --- Load checks (no error overlay, no fatal console errors) ---
    {
      name: 'Volvox demo loads',
      fn: async page => {
        await loadDemoAndCheck(page, 'test_data/volvox/config.json', 'ctgA')
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
        await loadDemoAndCheck(page, 'test_data/yeast_synteny/config.json')
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
      name: 'Methylation test demo loads',
      fn: async page => {
        await loadDemoAndCheck(
          page,
          'test_data/methylation_test/config.json',
        )
      },
    },
    {
      name: 'Modifications test demo loads',
      fn: async page => {
        await loadDemoAndCheck(
          page,
          'test_data/modifications_test/config.json',
        )
      },
    },
    {
      name: 'Honeybee demo loads',
      fn: async page => {
        await loadDemoAndCheck(page, 'test_data/honeybee/config.json')
      },
    },
    {
      name: 'Grape-peach synteny demo loads',
      fn: async page => {
        await loadDemoAndCheck(
          page,
          'test_data/config_synteny_grape_peach.json',
        )
      },
    },
    {
      name: 'CFAM2 (dog genome) demo loads',
      fn: async page => {
        await loadDemoAndCheck(page, 'test_data/cfam2/config.json')
      },
    },

    // --- Snapshot tests (rendered canvas verification) ---
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
    {
      name: 'Volvox multi-track demo screenshot',
      fn: async page => {
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: [
                'gff3tabix_genes',
                'volvox_filtered_vcf',
                'volvox_gc',
                'volvox_cram_alignments',
              ],
            },
          ],
        })

        await findByText(page, 'ctgA')
        await waitForDataLoaded(page)
        await page.waitForFunction(
          () =>
            document.querySelectorAll('[data-testid^="display-"]').length >= 3,
          { timeout: 60000 },
        )
        await delay(2000)
        await pageSnapshot(page, 'demo-volvox-multitrack-fullpage')
      },
    },
    {
      name: 'SARS-CoV2 demo screenshot',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'SARS-CoV-2',
                loc: 'NC_045512.2:1-29903',
                tracks: ['ncbi_gff_hg38'],
              },
            ],
          },
          'test_data/sars-cov2/config.json',
        )

        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid^="display-"] canvas')
        await canvasSnapshot(
          page,
          'demo-sars-cov2-canvas',
          '[data-testid^="display-"] canvas',
        )
      },
    },
    {
      name: 'Dotplot demo screenshot',
      fn: async page => {
        await page.goto(
          appendGpuParam(
            `http://localhost:${PORT}/?config=test_data/config_dotplot.json&sessionName=Demo%20Test`,
          ),
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await page.waitForSelector('[data-testid="dotplot_webgl_canvas"]', {
          timeout: 60000,
        })
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="dotplot_webgl_canvas"]',
        )
        await canvasSnapshot(
          page,
          'demo-dotplot-canvas',
          '[data-testid="dotplot_webgl_canvas"]',
        )
      },
    },
    {
      name: 'Yeast synteny demo screenshot',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['yeastR64_vs_YJM1447.paf'],
                views: [
                  { loc: 'chrI', assembly: 'R64' },
                  { loc: 'CM026499.1', assembly: 'YJM1447' },
                ],
              },
            ],
          },
          'test_data/yeast_synteny/config.json',
        )

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await canvasSnapshot(
          page,
          'demo-yeast-synteny-canvas',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
    {
      name: 'Breakpoint split view demo screenshot',
      fn: async page => {
        await page.goto(
          appendGpuParam(
            `http://localhost:${PORT}/?config=test_data/breakpoint/config.json`,
          ),
          { waitUntil: 'networkidle0', timeout: 60000 },
        )

        await findByTestId(page, 'pileup-display', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )
        await pageSnapshot(page, 'demo-breakpoint-split-view-fullpage')
      },
    },
    {
      name: 'Hi-C demo screenshot',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'hg19',
                loc: 'chr1:1..10,000,000',
                tracks: ['hic_test'],
              },
            ],
          },
          'extra_test_data/hic_integration_test.json',
        )

        await findByTestId(page, 'hic_canvas_done', 60000)
        await waitForDataLoaded(page)
        await canvasSnapshot(
          page,
          'demo-hic-canvas',
          '[data-testid="hic_canvas_done"]',
        )
      },
    },
    {
      name: 'Grape-peach synteny demo screenshot',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['subset'],
                views: [
                  {
                    loc: 'Pp01:28,845,211..28,845,272',
                    assembly: 'peach',
                  },
                  { loc: 'chr1:316,306..316,364', assembly: 'grape' },
                ],
              },
            ],
          },
          'test_data/grape_peach_synteny/config.json',
        )

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')
        await canvasSnapshot(
          page,
          'demo-grape-peach-synteny-canvas',
          '[data-testid="synteny_canvas"]',
        )
      },
    },
  ],
}

export default localDemos
