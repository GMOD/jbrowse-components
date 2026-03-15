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
  waitForDataLoaded,
  waitForLoadingToComplete,
} from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const downloadDir = path.resolve(__dirname, '../__downloads__')
const snapshotDir = path.resolve(__dirname, '../__snapshots__')

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

async function exportSvgAndSave(page: Page, name: string) {
  await triggerSvgExport(page)
  const svg = await waitForDownload('jbrowse.svg')
  if (!svg.includes('<svg')) {
    throw new Error('Downloaded file is not valid SVG')
  }
  fs.writeFileSync(path.join(snapshotDir, `${name}.svg`), svg)
  console.log(
    `    SVG saved: ${name}.svg (${(svg.length / 1024).toFixed(1)}KB)`,
  )
  return svg
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
        await waitForCanvasRendered(
          page,
          '[data-testid="wiggle-display"] canvas',
        )

        const svg = await exportSvgAndSave(page, 'svg-export-wiggle')
        if (!svg.includes('</svg>')) {
          throw new Error('SVG file appears truncated')
        }
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
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )

        await exportSvgAndSave(page, 'svg-export-alignments')
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
        await waitForCanvasRendered(
          page,
          '[data-testid="wiggle-display"] canvas',
        )

        await exportSvgAndSave(page, 'svg-export-multiple-tracks')
      },
    },
    {
      name: 'exports SVG with sequence track using monospace font',
      fn: async page => {
        await setupDownloadInterception(page)
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:100-200',
              tracks: ['volvox_refseq'],
            },
          ],
        })
        await waitForLoadingToComplete(page)
        await delay(2000)

        const svg = await exportSvgAndSave(page, 'svg-export-sequence')
        if (!svg.includes('font-family="monospace"')) {
          throw new Error(
            'Sequence track SVG missing monospace font-family attribute',
          )
        }
      },
    },
    {
      name: 'exports SVG with multi-wiggle track',
      fn: async page => {
        await setupDownloadInterception(page)
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-50000',
              tracks: ['volvox_microarray_multi_multirowxy'],
            },
          ],
        })
        await findByTestId(page, 'wiggle-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="wiggle-display"] canvas',
        )

        const svg = await exportSvgAndSave(page, 'svg-export-multi-wiggle')
        const rectCount = (svg.match(/<rect/g) || []).length
        if (rectCount < 10) {
          throw new Error(
            `Multi-wiggle SVG has too few rects (${rectCount}), expected rendered data`,
          )
        }
      },
    },
    {
      name: 'exports SVG with gene track (peptide labels)',
      fn: async page => {
        await setupDownloadInterception(page)
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1050-1150',
              tracks: ['gff3tabix_genes'],
            },
          ],
        })
        await page.waitForSelector('[data-testid^="display-"] canvas', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid^="display-"] canvas',
        )

        const svg = await exportSvgAndSave(page, 'svg-export-genes-peptides')
        const textCount = (svg.match(/<text/g) || []).length
        console.log(`    ${textCount} text elements`)
        if (textCount > 0 && !svg.includes('font-family="monospace"')) {
          throw new Error('Peptide text missing monospace font-family')
        }
      },
    },
    {
      name: 'exports SVG with alignments including sashimi arcs',
      fn: async page => {
        await setupDownloadInterception(page)
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['volvox_alignments_pileup_coverage'],
            },
          ],
        })
        await findByTestId(page, 'pileup-display', 60000)
        await waitForLoadingToComplete(page)
        await waitForCanvasRendered(
          page,
          '[data-testid="pileup-display"] canvas',
        )

        const svg = await exportSvgAndSave(page, 'svg-export-sashimi-arcs')
        const pathCount = (svg.match(/<path/g) || []).length
        console.log(`    ${pathCount} path elements (includes sashimi arcs)`)
      },
    },
    {
      name: 'exports SVG from 2-way synteny view',
      fn: async page => {
        await setupDownloadInterception(page)
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['subset'],
                views: [
                  { loc: 'Pp01:28,800,000..28,900,000', assembly: 'peach' },
                  { loc: 'chr1:300,000..400,000', assembly: 'grape' },
                ],
              },
            ],
          },
          'test_data/grape_peach_synteny/config.json',
        )

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')

        await exportSvgAndSave(page, 'svg-export-synteny-2way')
      },
    },
    {
      name: 'exports SVG from 3-way multi-level synteny view',
      fn: async page => {
        await setupDownloadInterception(page)
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearSyntenyView',
              tracks: [['volvox_ins.paf'], ['volvox_del.paf']],
              views: [
                { loc: 'ctgA:1-50000', assembly: 'volvox_ins' },
                { loc: 'ctgA:1-50000', assembly: 'volvox' },
                { loc: 'ctgA:1-50000', assembly: 'volvox_del' },
              ],
            },
          ],
        })

        await findByTestId(page, 'synteny_canvas', 60000)
        await waitForDataLoaded(page)
        await waitForCanvasRendered(page, '[data-testid="synteny_canvas"]')

        await exportSvgAndSave(page, 'svg-export-synteny-3way')
      },
    },
  ],
}

export default suite
