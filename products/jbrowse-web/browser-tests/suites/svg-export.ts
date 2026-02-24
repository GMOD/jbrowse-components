/* eslint-disable no-console */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForCanvasRendered,
  waitForLoadingToComplete,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const downloadDir = path.resolve(__dirname, '../__downloads__')

async function setupDownloadInterception(page: Page) {
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true })
  }
  const client = await page.createCDPSession()
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir,
  })
}

function waitForDownload(filename: string, timeout = 30000) {
  const filePath = path.join(downloadDir, filename)
  return new Promise<string>((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        fs.unlinkSync(filePath)
        resolve(content)
      } else if (Date.now() - start > timeout) {
        reject(new Error(`Download timeout: ${filename}`))
      } else {
        setTimeout(check, 200)
      }
    }
    check()
  })
}

async function triggerSvgExport(page: Page) {
  const viewMenu = await findByTestId(page, 'view_menu_icon', 10000)
  await viewMenu?.click()
  await delay(300)
  const exportSvg = await findByText(page, 'Export SVG', 10000)
  await exportSvg?.click()
  await delay(500)
  const submitBtn = await findByText(page, 'Submit', 10000)
  await submitBtn?.click()
}

const suite: TestSuite = {
  name: 'SVG Export',
  tests: [
    {
      name: 'exports SVG with wiggle track',
      fn: async page => {
        await setupDownloadInterception(page)
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:39,433..39,804',
              tracks: ['volvox_gc'],
            },
          ],
        })
        await findByTestId(page, 'wiggle-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(page, '[data-testid="wiggle-display"] canvas')

        await triggerSvgExport(page)
        const svg = await waitForDownload('jbrowse.svg')

        if (!svg.includes('<svg')) {
          throw new Error('Downloaded file is not valid SVG')
        }
        if (!svg.includes('</svg>')) {
          throw new Error('SVG file appears truncated')
        }
        console.log(`    SVG exported: ${(svg.length / 1024).toFixed(1)}KB`)
      },
    },
    {
      name: 'exports SVG with alignments track',
      fn: async page => {
        await setupDownloadInterception(page)
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_alignments_pileup_coverage'],
            },
          ],
        })
        await findByTestId(page, 'pileup-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(page, '[data-testid="pileup-display"] canvas')

        await triggerSvgExport(page)
        const svg = await waitForDownload('jbrowse.svg')

        if (!svg.includes('<svg')) {
          throw new Error('Downloaded file is not valid SVG')
        }
        console.log(`    SVG exported: ${(svg.length / 1024).toFixed(1)}KB`)
      },
    },
    {
      name: 'exports SVG with multiple tracks',
      fn: async page => {
        await setupDownloadInterception(page)
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-4000',
              tracks: ['volvox_gc', 'volvox_filtered_vcf_assembly_alias'],
            },
          ],
        })
        await findByTestId(page, 'wiggle-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(page, '[data-testid="wiggle-display"] canvas')

        await triggerSvgExport(page)
        const svg = await waitForDownload('jbrowse.svg')

        if (!svg.includes('<svg')) {
          throw new Error('Downloaded file is not valid SVG')
        }

        const rectCount = (svg.match(/<rect/g) || []).length
        const pathCount = (svg.match(/<path/g) || []).length
        console.log(
          `    SVG exported: ${(svg.length / 1024).toFixed(1)}KB, ${rectCount} rects, ${pathCount} paths`,
        )
      },
    },
  ],
}

export default suite
