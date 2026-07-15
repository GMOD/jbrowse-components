import {
  delay,
  findByTestId,
  findByText,
  navigateToUrl,
  navigateWithSessionSpec,
  waitForDataLoaded,
  waitForElementCount,
} from '../helpers.ts'
import { dualSnapshot, pageSnapshot } from '../snapshot.ts'
import { lgvSnapshotTest, viewSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const demoConfig = 'test_data/config_demo.json'

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

  await navigateToUrl(page, `config=${config}&sessionName=Demo%20Test`)

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

// Load checks (no error overlay, no fatal console errors). `[name, config]`,
// with an optional text to wait for before the error sweep.
const loadChecks: [string, string, string?][] = [
  ['Volvox', 'test_data/volvox/config.json', 'ctgA'],
  ['SARS-CoV2', 'test_data/sars-cov2/config.json'],
  ['Breakpoint split view', 'test_data/breakpoint/config.json'],
  ['Dotplot', 'test_data/config_dotplot.json'],
  ['Yeast synteny', 'test_data/yeast_synteny/config.json'],
  ['Hi-C', 'extra_test_data/hic_integration_test.json'],
  ['Methylation test', 'test_data/methylation_test/config.json'],
  ['Modifications test', 'test_data/modifications_test/config.json'],
  ['Honeybee', 'test_data/honeybee/config.json'],
  ['Grape-peach synteny', 'test_data/config_synteny_grape_peach.json'],
  ['CFAM2 (dog genome)', 'test_data/cfam2/config.json'],
  [
    'Maize EDTA transposable elements',
    'test_data/maize_te/config.json',
    'chr1',
  ],
]

const localDemos: TestSuite = {
  name: 'Demo Inventory (Local)',
  tests: [
    ...loadChecks.map(([label, config, waitText]) => ({
      name: `${label} demo loads`,
      fn: (page: Page) => loadDemoAndCheck(page, config, waitText),
    })),

    // --- Snapshot tests (rendered canvas verification) ---
    {
      name: 'Volvox demo has rendered canvas',
      fn: async page => {
        const spec = {
          views: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc: 'ctgA:1-10000',
              tracks: ['volvox_filtered_vcf'],
            },
          ],
        }
        await navigateToUrl(
          page,
          `config=test_data/volvox/config.json&session=spec-${encodeURIComponent(JSON.stringify(spec))}&sessionName=Demo%20Test`,
        )
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
        await waitForElementCount(page, '[data-testid^="display-"]', 3)
        await delay(2000)
        await pageSnapshot(page, 'demo-volvox-multitrack-fullpage')
      },
    },
    lgvSnapshotTest({
      name: 'SARS-CoV2 demo screenshot',
      snapshot: 'demo-sars-cov2',
      config: 'test_data/sars-cov2/config.json',
      assembly: 'Wuhan-Hu-1',
      loc: 'NC_045512.2:1-29903',
      tracks: ['sequence'],
    }),
    // Guards the repeat_region glyph: the intact LTR retrotransposon must render
    // its overlapping subparts (LTRs/TSDs/internal element) rather than collapse
    // to a flat box. This glyph silently regressed once in the canvas refactor.
    lgvSnapshotTest({
      name: 'Maize EDTA transposon subparts screenshot',
      snapshot: 'demo-maize-edta-te',
      config: 'test_data/maize_te/config.json',
      assembly: 'Zm-B73-NAM5',
      loc: 'chr1:59,500-71,000',
      tracks: ['maize_b73_edta_te'],
    }),
    {
      name: 'Dotplot demo screenshot',
      fn: async page => {
        await navigateToUrl(
          page,
          'config=test_data/config_dotplot.json&sessionName=Demo%20Test',
        )

        await page.waitForSelector(
          '[data-testid="dotplot_webgl_canvas_done"]',
          {
            timeout: 60000,
          },
        )
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'demo-dotplot-canvas',
          '[data-testid="dotplot_webgl_canvas_done"]',
        )
      },
    },
    viewSnapshotTest({
      name: 'Yeast synteny demo screenshot',
      requiresRemote: true,
      snapshot: 'demo-yeast-synteny',
      config: 'test_data/yeast_synteny/config.json',
      view: {
        type: 'LinearSyntenyView',
        tracks: ['dotplot_track'],
        views: [
          { loc: 'NC_001133.9', assembly: 'R64' },
          { loc: 'I', assembly: 'YJM1447' },
        ],
      },
      waitTestId: 'synteny_canvas_done',
    }),
    viewSnapshotTest({
      name: 'Yeast whole-genome synteny screenshot',
      requiresRemote: true,
      snapshot: 'demo-yeast-wholegenome-synteny',
      config: 'test_data/yeast_synteny/config.json',
      timeout: 120000,
      // whole-genome R64 vs YJM1447 — omitting loc shows all 16 chromosomes
      // with the near-collinear syntenic ribbons between the two strains
      view: {
        type: 'LinearSyntenyView',
        tracks: ['dotplot_track_cigar'],
        views: [{ assembly: 'R64' }, { assembly: 'YJM1447' }],
      },
      waitTestId: 'synteny_canvas_done',
    }),
    {
      name: 'Breakpoint split view demo screenshot',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/breakpoint/config.json')

        await findByTestId(page, 'pileup-display-done', 60000)
        await waitForDataLoaded(page)
        await pageSnapshot(page, 'demo-breakpoint-split-view-fullpage')
      },
    },
    viewSnapshotTest({
      name: 'Hi-C demo screenshot',
      snapshot: 'demo-hic',
      config: 'extra_test_data/hic_integration_test.json',
      view: {
        type: 'LinearGenomeView',
        assembly: 'hg19',
        loc: 'chr1:1..10,000,000',
        tracks: ['hic_test'],
      },
      waitTestId: 'hic-display-done',
      snapshotSelector: '[data-testid="hic_canvas"]',
    }),
    lgvSnapshotTest({
      name: 'hg19 gene glyph rendering',
      snapshot: 'demo-hg19-gene-glyph',
      config: demoConfig,
      assembly: 'hg19',
      loc: '1:47,678,865..47,688,389',
      tracks: ['ncbi_gff_hg19'],
    }),
    lgvSnapshotTest({
      name: 'COLO829 whole-genome wiggle overview',
      requiresRemote: true,
      snapshot: 'demo-colo829-wholegenome-wiggle',
      config: demoConfig,
      assembly: 'hg19',
      // omitting loc triggers showAllRegionsInAssembly — shows all hg19
      // chromosomes at once with tumor/normal BigWig coverage side by side
      tracks: ['colo_tumor', 'colo_normal'],
      doneTestId: 'wiggle-display-done',
    }),
    lgvSnapshotTest({
      name: 'Nanopore EGFR amplicon alignments',
      requiresRemote: true,
      snapshot: 'demo-nanopore-egfr',
      config: demoConfig,
      assembly: 'hg38',
      // 0.1x-downsampled nanopore amplicon reads at the EGFR locus on hg38
      // (the full-coverage track causes OOM, so we use the downsampled one)
      loc: 'chr7:55,000,000-56,000,000',
      tracks: ['nanopore_targeted_alignments_0.1'],
      doneTestId: 'pileup-display-done',
    }),
    viewSnapshotTest({
      name: 'Grape-peach synteny demo screenshot',
      snapshot: 'demo-grape-peach-synteny',
      config: 'test_data/grape_peach_synteny/config.json',
      view: {
        type: 'LinearSyntenyView',
        tracks: ['subset'],
        views: [
          { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
          { loc: 'chr1:316,306..316,364', assembly: 'grape' },
        ],
      },
      waitTestId: 'synteny_canvas_done',
    }),
  ],
}

export default localDemos
