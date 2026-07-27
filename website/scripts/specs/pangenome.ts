import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the E. coli pangenome tutorial (pangenome_ecoli.md). They load the
// hosted ecoli_pangenome demo config, whose pggb-graph tracks
// (ecoli_pggb_variants, ecoli_pggb_maf) are newer than
// jbrowse.org/code/jb2/latest, as a bare ?config= against the local build. Each
// projection is projected onto the K12 reference, so each figure is a plain
// LinearGenomeView on K12 with the K12 gene lane for context. Remote demo data →
// generous settle.
//
// The graph-view figures (the Bandage force-directed and rGFA anchored subgraph
// pictures) moved out with the GraphGenomeView, which is now the third-party
// jbrowse-plugin-graphgenomeview and no longer bundled in jbrowse-web. They live
// in specs/graph.ts, which loads that plugin by esmUrl from a fixture config, so
// they are generated and live-linkable like everything else here.
const CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/ecoli_pangenome/config.json',
)

export const pangenomeSpecs: ScreenshotSpec[] = [
  // Projection 1: the graph's own all-vs-all alignment, the wfmash PAF pggb
  // built the graph FROM (ecoli_pggb_ava), stacked the same way the all-vs-all
  // tutorial stacks its minimap2 PAF.
  //
  // This page used to illustrate that section with the minimap2 figure
  // (multiway_synteny/ecoli_pangenome) under a caption claiming it was wfmash's
  // — the same picture doing duty for two different files. They are worth
  // seeing side by side precisely because they nearly agree: an independent
  // pairwise aligner and the graph's own input alignment put the backbone and
  // IAI39's inversions in the same places.
  //
  // wfmash's segments are shorter than minimap2's asm20 blocks, so the same
  // 10 kb minAlignmentLength leaves a denser band rather than a few clean
  // ribbons; that density IS the difference between the two files and is left
  // alone rather than filtered away.
  {
    mode: 'url',
    name: 'pangenome/pggb_synteny',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          // same row order as the minimap2 stack, so the two figures are
          // comparable line for line
          views: [
            { assembly: 'K12' },
            { assembly: 'Sakai' },
            { assembly: 'CFT073' },
            { assembly: 'NCTC86' },
            { assembly: 'IAI39' },
          ],
          tracks: [
            ['ecoli_pggb_ava'],
            ['ecoli_pggb_ava'],
            ['ecoli_pggb_ava'],
            ['ecoli_pggb_ava'],
          ],
          drawCurves: false,
          colorBy: 'default',
          minAlignmentLength: 10000,
          levelHeights: [110, 110, 110, 110],
        },
      ],
    }),
    // five rows and four 110px bands
    viewportHeight: 1030,
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
  },
  // Projection 2: the graph's pangenome variants as a multi-sample display, with
  // the MAF alignment stacked below as an orthogonal view of the same window.
  // One row per non-K12 strain, each variant drawn at its genomic position and
  // colored by that strain's genotype (the per-position display, not the matrix
  // — reviewer's call, so the columns line up with the genes and the MAF below;
  // the spec was named `variant_matrix` until then, which is why the figure was
  // read as a broken matrix). Runs of shared alt across strains read as vertical
  // bands — the accessory structure of the pangenome at SNP resolution. The MAF
  // below is the same window's base-level multiple alignment, the representation
  // the variants were decomposed from, so the variant rows can be read against
  // the per-strain alignment they came from.
  //
  // The window is chosen from the VCF, not by eye. Scoring every 20 kb window on
  // "each strain carries alt calls and few no-calls" puts chr:2,120,000-2,140,000
  // first: ~1,000 sub-100bp records with 43-57% alt per strain and under 2%
  // no-call. The old window (995,000-1,015,000) scored badly on exactly what the
  // review flagged as odd-looking: NCTC86 was reference at 979 of its 988 calls
  // there (one flat grey row) and CFT073 was no-call at 411 of them (one flat
  // yellow band), so two of the four rows carried no visible structure.
  {
    mode: 'url',
    name: 'pangenome/pangenome_variants',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:2,120,000-2,140,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              trackId: 'ecoli_pggb_variants',
              type: 'LinearMultiSampleVariantDisplay',
              height: 160,
              // pggb's VCF is NESTED: alongside the SNPs it emits bubble
              // records hundreds to thousands of bp wide, which paint over the
              // fine layer decomposed from them. 178 of the file's 174,439
              // records span a kilobase or more; two in this window exceed
              // 100 bp (widest 429 bp at chr:2,139,331), and the MAF figure's
              // window carries a 20,639 bp one. Filtering to <100 bp keeps the
              // decomposed SNP layer, which is what the figure is about.
              // (An earlier revision cited a 7,094 bp record here; that was the
              // pre-IAI39 four-strain VCF and no longer reproduces.)
              jexlFilters: [
                "jexl:get(feature,'end')-get(feature,'start') < 100",
              ],
            },
            { trackId: 'ecoli_pggb_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    // interior ruler tick (the window edges aren't rendered as tick labels;
    // ticks fall on 4kb multiples at this zoom)
    readyText: '2,124,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the app window ends at 681 CSS px here (four variant rows over the MAF's
    // five), so anything taller is empty page background
    viewportHeight: 700,
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
  // each colored where it differs from K12.
  //
  // 60 kb rather than the 6 kb this used to show (reviewer: "zoom out more"). At
  // 6 kb every row was continuous backbone, so the figure could only say "these
  // strains differ by SNPs" - a fact the variant figure above already carries.
  // The window is picked from the odgi pav bigWigs rather than by eye: scoring
  // every 60 kb window on "each strain is partly present and partly absent"
  // (8-40% of its 500bp bins absent) puts chr:4,540,000-4,600,000 top, with all
  // four strains between 29% and 40% absent. So the rows now show what only a
  // zoomed-out MAF can: where each strain stops aligning to K12 at all, against
  // the backbone it shares.
  {
    mode: 'url',
    name: 'pangenome/maf',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:4,540,000-4,600,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              // the same window's variant calls above the alignment they were
              // decomposed from (reviewer: show the evidence sources side by
              // side). Same <100 bp filter as the variant figure, for the same
              // nested-bubble reason.
              trackId: 'ecoli_pggb_variants',
              type: 'LinearMultiSampleVariantDisplay',
              height: 120,
              jexlFilters: [
                "jexl:get(feature,'end')-get(feature,'start') < 100",
              ],
            },
            { trackId: 'ecoli_pggb_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    readyText: '4,560,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the variant lane plus one MAF row per sample and the coverage band
    viewportHeight: 660,
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
  // at a glance. No gene lane: at 4.6 Mb the ~4,300 K12 genes only trip the
  // FeatureTrack "too many features" gate, so the depth curve carries the figure
  // on its own.
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
            {
              trackId: 'ecoli_pggb_depth',
              type: 'LinearWiggleDisplay',
              height: 200,
            },
          ],
        },
      ],
    }),
    readyText: 'pangenome depth',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 360,
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
  // accessory dips read at a glance beside the aggregate depth curve. No gene
  // lane, same as the depth figure above.
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
            {
              trackId: 'ecoli_pggb_pav',
              type: 'MultiLinearWiggleDisplay',
              height: 320,
            },
          ],
        },
      ],
    }),
    readyText: 'per-strain presence',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 530,
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
