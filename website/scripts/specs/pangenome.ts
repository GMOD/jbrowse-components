import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the pangenome-graph tutorial (pangenome.md). They load the hosted
// ecoli_pangenome demo config, whose pggb-graph tracks (ecoli_pggb_variants,
// ecoli_pggb_maf) are newer than jbrowse.org/code/jb2/latest, as a bare
// ?config= against the local build. All three graph projections are projected
// onto the K12 reference, so each figure is a plain LinearGenomeView on K12 with
// the K12 gene lane for context. Remote demo data → generous settle.
const CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/ecoli_pangenome/config.json',
)

export const pangenomeSpecs: ScreenshotSpec[] = [
  // Projection 2: the graph's pangenome variants as a multi-sample matrix. Each
  // column is one variant the graph called against K12, each row one of the
  // three other strains; the cell color is that strain's genotype. Runs of
  // shared alt across CFT073/NCTC86 vs Sakai (and vice-versa) read as vertical
  // bands — the accessory structure of the pangenome at SNP resolution.
  {
    mode: 'url',
    name: 'pangenome/variant_matrix',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1,000,000-1,010,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              trackId: 'ecoli_pggb_variants',
              type: 'LinearMultiSampleVariantMatrixDisplay',
              height: 160,
            },
          ],
        },
      ],
    }),
    readyText: '1,010,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 540,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      // park the cursor over the inert app header so no overview-ruler position
      // tooltip or feature hover lingers in the capture
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 3: the graph's whole-genome alignment as a MAF, projected onto
  // K12. The coverage band on top, then one row per strain (K12 reference first),
  // each colored where it differs from K12. This window sits on the shared
  // backbone where all four strains align continuously (taffy coverage: CFT073
  // and Sakai align ~1:1 to K12 across it, no large insertions or deletions), so
  // each strain's mismatch columns read as pure SNP divergence from K12 — not the
  // accessory-region indels that dominate elsewhere in the pangenome.
  {
    mode: 'url',
    name: 'pangenome/maf',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:800,000-806,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            { trackId: 'ecoli_pggb_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    readyText: '806,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 440,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      // park the cursor over the inert app header so no overview-ruler position
      // tooltip or feature hover lingers in the capture
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
]
