/* eslint-disable no-console */
import fs from 'fs'
import os from 'os'
import path from 'path'

import {
  PORT,
  delay,
  findByTestId,
  findByText,
  navigateWithSessionSpec,
  waitForDataLoaded,
  waitForLoadingToComplete,
} from '../helpers.ts'
import { snapshotConfig } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// Returns a fresh per-test temp directory so concurrent tests never share a
// download path and overwrite each other's jbrowse.svg.
async function setupDownloadInterception(page: Page) {
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-svg-dl-'))
  const client = await page.createCDPSession()
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir,
  })
  return downloadDir
}

function waitForDownload(
  downloadDir: string,
  filename: string,
  timeout = 30000,
) {
  const filePath = path.join(downloadDir, filename)
  return new Promise<string>((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        fs.rmSync(downloadDir, { recursive: true, force: true })
        resolve(content)
      } else if (Date.now() - start > timeout) {
        fs.rmSync(downloadDir, { recursive: true, force: true })
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

async function exportSvgAndSave(page: Page, downloadDir: string, name: string) {
  await triggerSvgExport(page)
  const svg = await waitForDownload(downloadDir, 'jbrowse.svg')
  if (!svg.includes('<svg')) {
    throw new Error('Downloaded file is not valid SVG')
  }
  // Write into the active backend's subfolder (canvas2d/ webgl/ webgpu/), same
  // as the PNG snapshots — not the bare __snapshots__ root.
  const dir = snapshotConfig.snapshotsDir
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(path.join(dir, `${name}.svg`), svg)
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
        const downloadDir = await setupDownloadInterception(page)
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
        await findByTestId(page, 'wiggle-display-done', 60000)
        await waitForLoadingToComplete(page)

        const svg = await exportSvgAndSave(
          page,
          downloadDir,
          'svg-export-wiggle',
        )
        if (!svg.includes('</svg>')) {
          throw new Error('SVG file appears truncated')
        }
      },
    },
    {
      name: 'exports SVG with alignments track',
      fn: async page => {
        const downloadDir = await setupDownloadInterception(page)
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
        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForLoadingToComplete(page)

        await exportSvgAndSave(page, downloadDir, 'svg-export-alignments')
      },
    },
    {
      name: 'exports SVG with multiple tracks',
      fn: async page => {
        const downloadDir = await setupDownloadInterception(page)
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
        await findByTestId(page, 'wiggle-display-done', 60000)
        await waitForLoadingToComplete(page)

        await exportSvgAndSave(page, downloadDir, 'svg-export-multiple-tracks')
      },
    },
    {
      name: 'exports SVG with sequence track',
      fn: async page => {
        const downloadDir = await setupDownloadInterception(page)
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

        // The sequence layer is canvas-drawn (drawSequence) and routed through
        // paintLayer, so the default SVG export rasterizes it into an <image>
        // (the old monospace <text> path no longer exists).
        const svg = await exportSvgAndSave(
          page,
          downloadDir,
          'svg-export-sequence',
        )
        if (!svg.includes('<image')) {
          throw new Error(
            'Sequence track SVG missing rasterized sequence image',
          )
        }
      },
    },
    {
      name: 'exports SVG with multi-wiggle track',
      fn: async page => {
        const downloadDir = await setupDownloadInterception(page)
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
        await findByTestId(page, 'multi-wiggle-display-done', 60000)
        await waitForLoadingToComplete(page)

        const svg = await exportSvgAndSave(
          page,
          downloadDir,
          'svg-export-multi-wiggle',
        )
        // multirowxy renders as lines, not rects
        const lineCount = (svg.match(/<line/g) ?? []).length
        if (lineCount < 10) {
          throw new Error(
            `Multi-wiggle SVG has too few lines (${lineCount}), expected rendered data`,
          )
        }
      },
    },
    {
      name: 'exports SVG with gene track (peptide labels)',
      fn: async page => {
        const downloadDir = await setupDownloadInterception(page)
        // Navigate to app first to establish origin, then enable colorByCDS
        // so amino acid overlays are rendered in SVG
        await page.goto(`http://localhost:${PORT}/`)
        await page.evaluate(() => {
          localStorage.setItem('lgv-colorByCDS', 'true')
        })
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1201-1350',
              tracks: ['gff3tabix_genes'],
            },
          ],
        })
        await page.waitForSelector('[data-testid$="-done"]', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)

        const svg = await exportSvgAndSave(
          page,
          downloadDir,
          'svg-export-genes-peptides',
        )
        const textCount = (svg.match(/<text/g) ?? []).length
        console.log(`    ${textCount} text elements`)
        if (textCount > 0 && !svg.includes('font-family="monospace"')) {
          throw new Error('Peptide text missing monospace font-family')
        }
      },
    },
    {
      // The contigA gene track names its features 'contigA' (a volvox alias for
      // ctgA), while the sequence adapter (volvox.2bit) uses 'ctgA'. So the
      // renamed region has refName 'contigA' (gene adapter) but originalRefName
      // 'ctgA' (FASTA). Peptide translation must fetch sequence by
      // originalRefName, or the FASTA lookup misses and no amino-acid text is
      // emitted — making this the discriminating test for the originalRefName
      // (formerly seqAdapterRefName) sequence-fetch path.
      name: 'exports SVG gene track peptides across a refName alias',
      fn: async page => {
        const downloadDir = await setupDownloadInterception(page)
        await page.goto(`http://localhost:${PORT}/`)
        await page.evaluate(() => {
          localStorage.setItem('lgv-colorByCDS', 'true')
        })
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1201-1350',
              tracks: ['gff3tabix_genes_contigA_alias'],
            },
          ],
        })
        await page.waitForSelector('[data-testid$="-done"]', {
          timeout: 60000,
        })
        await waitForLoadingToComplete(page)

        const svg = await exportSvgAndSave(
          page,
          downloadDir,
          'svg-export-genes-peptides-alias',
        )
        const textCount = (svg.match(/<text/g) ?? []).length
        console.log(`    ${textCount} text elements`)
        if (!svg.includes('font-family="monospace"')) {
          throw new Error(
            'Peptide text missing across alias: sequence fetch did not use originalRefName',
          )
        }
      },
    },
    {
      name: 'exports SVG with alignments including sashimi arcs',
      fn: async page => {
        const downloadDir = await setupDownloadInterception(page)
        // 'spliced' is the volvox-rnaseq BAM — spliced reads (N CIGAR) are what
        // produce sashimi arcs; the plain DNA alignment track has none.
        await navigateWithSessionSpec(page, {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['spliced'],
            },
          ],
        })
        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForLoadingToComplete(page)

        const svg = await exportSvgAndSave(
          page,
          downloadDir,
          'svg-export-sashimi-arcs',
        )
        const pathCount = (svg.match(/<path/g) ?? []).length
        console.log(`    ${pathCount} path elements (includes sashimi arcs)`)
        if (pathCount === 0) {
          throw new Error('sashimi SVG export has no <path> elements (no arcs)')
        }
      },
    },
    {
      name: 'exports SVG from 2-way synteny view',
      fn: async page => {
        const downloadDir = await setupDownloadInterception(page)
        await navigateWithSessionSpec(
          page,
          {
            views: [
              {
                type: 'LinearSyntenyView',
                tracks: ['subset'],
                // subset.paf has a single 394bp alignment
                // (Pp01:28,845,209-28,845,603 <-> chr1:315,959-316,369); zoom
                // tight around it so the ribbon is visible rather than a
                // sub-pixel sliver in a 100kb window.
                views: [
                  { loc: 'Pp01:28,845,000..28,845,800', assembly: 'peach' },
                  { loc: 'chr1:315,800..316,500', assembly: 'grape' },
                ],
              },
            ],
          },
          'test_data/grape_peach_synteny/config.json',
        )

        await findByTestId(page, 'synteny_canvas_done', 60000)
        await waitForDataLoaded(page)

        await exportSvgAndSave(page, downloadDir, 'svg-export-synteny-2way')
      },
    },
    {
      name: 'exports SVG from 3-way multi-level synteny view',
      fn: async page => {
        const downloadDir = await setupDownloadInterception(page)
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

        await findByTestId(page, 'synteny_canvas_done', 60000)
        await waitForDataLoaded(page)

        await exportSvgAndSave(page, downloadDir, 'svg-export-synteny-3way')
      },
    },
  ],
}

export default suite
