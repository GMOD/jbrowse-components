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
          loc: 'chr:995,000-1,015,000',
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
    // interior ruler tick (the window end 1,015,000 lands at the edge and isn't
    // rendered as a tick label; ticks fall on 4kb multiples at this zoom)
    readyText: '1,000,000',
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

  // Projection 4: pangenome depth (core vs accessory) from `odgi depth`, as a
  // whole-chromosome overview so the shared plateau and the accessory dips read
  // at a glance. NOTE: the ecoli_pggb_depth track only exists once the demo is
  // rebuilt (build_ecoli_pangenome_graph.sh) and redeployed to S3 — regenerate
  // this figure after that redeploy.
  {
    mode: 'url',
    name: 'pangenome/depth',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              trackId: 'ecoli_pggb_depth',
              type: 'LinearWiggleDisplay',
              height: 160,
            },
          ],
        },
      ],
    }),
    readyText: '4,000,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 420,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      // park the cursor over the inert app header so no overview-ruler position
      // tooltip or feature hover lingers in the capture
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 4b: per-strain presence from `odgi pav` as a MultiQuantitativeTrack
  // — one bigWig subtrack per non-K12 strain, whole-chromosome so each strain's
  // accessory dips read at a glance beside the aggregate depth curve. NOTE: the
  // ecoli_pggb_pav track (and its per-strain bigWigs) only exist once the demo is
  // rebuilt (build_ecoli_pangenome_graph.sh) and redeployed to S3 — regenerate
  // this figure after that redeploy.
  {
    mode: 'url',
    name: 'pangenome/pav',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              trackId: 'ecoli_pggb_pav',
              type: 'MultiLinearWiggleDisplay',
              height: 200,
            },
          ],
        },
      ],
    }),
    readyText: '4,000,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 460,
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
