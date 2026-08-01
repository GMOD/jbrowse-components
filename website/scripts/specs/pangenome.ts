import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { ECOLI_DEMO_BASE } from './demoBase.ts'

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
const CONFIG = encodeURIComponent(`${ECOLI_DEMO_BASE}/config.json`)

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
              // side).
              //
              // No jexl length filter any more. It was here to hide the snarl
              // tree's wide parent records, which drew over the fine layer they
              // were decomposed from; `pggb -V K12:100000` pops those in the
              // pipeline (vcfbub | vcfwave) so the track loads an already-flat
              // tier. Keeping the filter would now drop real indels instead.
              trackId: 'ecoli_pggb_variants',
              type: 'LinearMultiSampleVariantDisplay',
              height: 120,
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

  // Projection 1b: the same strains, with the ribbons read out of the graph by
  // `odgi untangle` rather than off the wfmash PAF the graph was induced from.
  //
  // K12 IN THE MIDDLE, and three rows rather than five. untangle projects query
  // paths onto a TARGET path, so every record in that file has K12 on one side;
  // it is reference-relative by construction, where the wfmash PAF is genuinely
  // all-vs-all. A five-row stack compares adjacent rows, so the Sakai/CFT073 and
  // NCTC86/IAI39 bands would have no records at all and the figure would read as
  // a broken track rather than as a different projection. With the reference
  // between them both drawn bands are K12-relative, which is what the file is.
  {
    mode: 'url',
    name: 'pangenome/pggb_untangle',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            { assembly: 'CFT073' },
            { assembly: 'K12' },
            { assembly: 'Sakai' },
          ],
          tracks: [['ecoli_pggb_untangle'], ['ecoli_pggb_untangle']],
          drawCurves: false,
          colorBy: 'default',
          minAlignmentLength: 10000,
          levelHeights: [140, 140],
        },
      ],
    }),
    // three rows and two 140px bands
    viewportHeight: 720,
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
  },

  // Projection 2: the decomposed variant tier, which had no figure at all while
  // this page's only view of it was the lane riding above the MAF. The matrix
  // display rather than the per-position one: it is the display that reads a
  // pangenome VCF as a sample-by-site matrix, which is what a callset over a
  // graph is for.
  //
  // No jexl length filter, unlike the MAF figure. That filter existed to hide
  // the snarl tree's wide parent records, and `pggb -V K12:100000` pops them in
  // the pipeline instead (vcfbub -l 0 -a 100000 | vcfwave), so the track loads
  // an already-flat tier and the display needs nothing said to it.
  //
  // The same 60 kb window the MAF figure uses, picked from the odgi pav bigWigs
  // for "each strain partly present and partly absent", so the matrix has both
  // shared and strain-specific columns rather than a wall of one color.
  {
    mode: 'url',
    name: 'pangenome/pggb_variants',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:4,540,000-4,600,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              trackId: 'ecoli_pggb_variants',
              type: 'LinearMultiSampleVariantMatrixDisplay',
              height: 260,
            },
          ],
        },
      ],
    }),
    readyText: '4,560,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 480,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 4: pangenome depth (core vs accessory) from `odgi depth`, above
  // graph complexity from `odgi degree`, as a whole-chromosome overview so the
  // shared plateau and the accessory dips read at a glance. No gene lane: at
  // 4.6 Mb the ~4,300 K12 genes only trip the FeatureTrack "too many features"
  // gate, so the two curves carry the figure on their own.
  //
  // Both in one frame rather than two figures, because separately they are two
  // near-identical whole-genome curves and the point is where they DISAGREE:
  // depth counts paths present, degree counts branching, so a window can be
  // fully covered and still tangled.
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
            {
              trackId: 'ecoli_pggb_degree',
              type: 'LinearWiggleDisplay',
              height: 200,
            },
          ],
        },
      ],
    }),
    readyText: 'graph complexity',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 560,
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
