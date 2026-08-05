import { displayReady, sessionSpec } from '../screenshot-spec-helpers.ts'
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
  // DEFAULT ALPHA, and the reason is worth keeping because this figure carried
  // the workaround for a year. wfmash maps all-to-all in both directions, so
  // K12->Sakai and Sakai->K12 are both in the PAF and describe the same spans
  // (measured on the published pif: 4.379 Mb of the K12 axis from one
  // direction, 4.381 Mb from the other, block starts within ~100 bp of each
  // other), and the adapter used to union both perspectives of the anchor. Two
  // 0.2 ribbons composite to #FFA3A3 where the minimap2 figure's one draws
  // #FFCCCC — "these polygons are darker than the other synteny figures", twice
  // in review. This spec answered it with alpha 0.1, which is half the ink for
  // twice the ribbons and only looks right while the file stays reciprocal.
  //
  // AllVsAll{,Indexed}PAFAdapter now drops the second statement of a homology
  // (createReciprocalDedupe), so a band is one ribbon at the alpha every other
  // synteny figure uses, and the minimap2 stack beside it — whose all_vs_all.paf
  // is upper-triangular, each unordered pair once — needs no compensation to be
  // comparable.
  //
  // Not a density difference, whatever an older comment said: over the
  // K12/Sakai band past the 10 kb cutoff minimap2 keeps 119 records and wfmash
  // 41 (21 of them the mirror of the other 20, which is what is dropped).
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
          // same as the minimap2 stack: no row carries a track, so each one
          // collapses to a bare scalebar instead of a "No tracks active" block
          collapseEmptyRows: true,
        },
      ],
    }),
    // five collapsed scalebar rows and four 110px bands, matching the minimap2
    // figure's framing so the two are comparable line for line
    viewportHeight: 715,
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
              // were decomposed from; `pggb -V K12:10000` pops those in the
              // pipeline (vcfbub | vcfwave) so the track loads an already-flat
              // tier. Keeping the filter would now drop real indels instead.
              trackId: 'ecoli_pggb_variants',
              type: 'LinearMultiSampleVariantDisplay',
              // Four strain rows and nothing else, which is what the lane is
              // for here (reviewer: "reduce height of multisamplevariantdisplay").
              //
              // It sat at 170 because the legend does not fit in 120: it is the
              // genotype key plus an Insertions section, ~160px inside a track
              // container that paint-clips its own box, so at 120 the last
              // swatch was sliced in half by the track boundary. The height was
              // raised to the legend rather than the legend cut to the height.
              // The action below hides it instead, and the caption names the
              // colors -- see there for why this lane in particular can spare
              // the key.
              height: 120,
            },
            { trackId: 'ecoli_pggb_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    readyText: '540,000',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the variant lane plus one MAF row per sample and the coverage band
    viewportHeight: 660,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      // The variant lane's own key, dismissed through the button it carries.
      // Two reasons it is the one legend in the set that can go: its allele-count
      // vocabulary ("Homozygous alt", "Heterozygous") describes a diploid callset
      // and these are four haploid strains, and this lane is context under the
      // MAF projection the figure is actually about. A missing selector throws
      // the regen, so this cannot fail into a silently clipped legend the way a
      // hideSelectors rule would.
      { type: 'click', selector: '[title="Hide legend"]' },
      // park the cursor over the inert app header so no overview-ruler position
      // tooltip or feature hover lingers in the capture
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 1b: the ribbons read OUT of the graph by `odgi untangle`, rather
  // than off the wfmash PAF the graph was induced from.
  //
  // Framed on the one thing untangle says that a pairwise PAF cannot, rather
  // than on another whole-genome stack: a collapsed repeat, where two locations
  // in a query path come back pointing at the SAME reference span. Whole-genome,
  // this file draws the same near-colinear diagonals as the wfmash figure above
  // and the difference between the two projections is invisible.
  //
  // The locus is read off the file, not chosen: K12 chr:3,941,447-3,946,786 is
  // the only span in ecoli_pggb_untangle.pif.gz that more than one segment of a
  // query lands on, and three of the four strains do it there —
  //   zcat ecoli_pggb_untangle.pif.gz | awk -F'\t' 'substr($1,1,1)=="q"'
  // has Sakai at 4,735,016 and 4,975,690, NCTC86 at 4,313,805 and 4,538,509,
  // IAI39 at 3,134,233 and 4,546,355, all 5.3-5.4 kb and all onto that one K12
  // span. It is an rRNA operon: seqwish collapsed the copies into one set of
  // nodes, so the graph has one place where the genome has several.
  //
  // Sakai and NCTC86 flank K12 because their two copies are ~230 kb apart and so
  // fit one window each; IAI39's are 1.4 Mb apart and would need a window wide
  // enough to make both slivers subpixel. Each flanking row frames both of its
  // copies and K12 frames the shared span, so each band draws the fan.
  {
    mode: 'url',
    name: 'pangenome/pggb_untangle',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            { assembly: 'NCTC86', loc: 'chr:4,310,000-4,548,000' },
            {
              assembly: 'K12',
              loc: 'chr:3,940,800-3,947,400',
              // the gene lane names the repeat rather than leaving the caption
              // to assert it: the shared span carries rrsC/rrlC and their tRNAs
              tracks: [{ trackId: 'K12_genes' }],
            },
            { assembly: 'Sakai', loc: 'chr:4,731,000-4,985,000' },
          ],
          tracks: [['ecoli_pggb_untangle'], ['ecoli_pggb_untangle']],
          drawCurves: false,
          colorBy: 'default',
          levelHeights: [140, 140],
        },
      ],
    }),
    // two flanking scalebar rows, the K12 row with its gene lane, two 140px bands
    viewportHeight: 735,
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    settleMs: 15000,
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
  //
  // `readyText: 'graph complexity'` is the gate on the second lane: it fails
  // rather than quietly capturing half the figure if ecoli_pggb_degree ever
  // drops out of the hosted config again.
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
    // two 200px wiggle lanes plus their axes and the view chrome. Measured
    // against the rebuilt demo, where 560 cut 77px off the bottom of the degree
    // lane, so the second curve was clipped in a figure that is about comparing
    // the two.
    viewportHeight: 640,
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

  // What a depth trough IS, at single-read resolution. The depth and pav tracks
  // say K12 carries sequence no other strain does; this is an unrelated clinical
  // isolate's nanopore reads over one of those troughs, and the absence is the
  // same absence.
  //
  // The locus is read off the data rather than chosen. `odgi pav` for NCTC86
  // gives 52 K12 spans no other strain traverses; the ones a long read can span
  // whole are 2-9 kb, and CPZ-55 at chr:2,559,000-2,565,000 is where the reads
  // are unambiguous. Measured on the BAM this figure loads:
  //   flanks     11-15x
  //   2,559,000-2,565,000   exactly 0x
  //   right flank 16x
  // and the reads that cross it carry ONE deletion of 6,789-6,791 bp (five of
  // them at last count, starting anywhere from 2,545,683 to 2,554,482). So the
  // pileup shows the event twice over: a hole with hard edges, and a wall of
  // reads each drawing the same gap.
  //
  // The gene lane is the point of the window, not decoration — intZ and yffL-yffS
  // name the CPZ-55 cryptic prophage, so the figure says which mobile element the
  // trough is rather than just that a trough exists.
  //
  // NOT whole-genome and not the other two prophages: CP4-6 (263-297 kb) reads
  // 2.8x and DLP12 (566.5-573.5 kb) 4.8x in this isolate, which is partial
  // carriage and a muddier picture. CPZ-55 is the clean one.
  {
    mode: 'url',
    name: 'pangenome/long_reads',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:2,554,000-2,570,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              trackId: 'ecoli_e146_ont',
              // 320 left half the lane empty: this slice is ~20x, so the reads
              // stack about 10 deep and the rest was white
              type: 'LinearAlignmentsDisplay',
              // Link supplementary alignments (review: "view as pairs/link supp
              // reads likely can be toggled too"). VIEW AS PAIRS has nothing to
              // act on -- these are ONT reads and not one of the 38 in this
              // window carries the paired flag -- but LINK SUPPLEMENTARY does:
              // 18 of them carry an SA tag, 10 supplementary alignments land
              // here, and 18 of the 22 SA segments map back into 2.5-2.6 Mb, so
              // the chains are local. `linkedReads: 'normal'` is the one setting
              // behind both menu items; on unpaired reads it chains a read's own
              // supplementary segments. That says something the CIGAR deletion
              // cannot: which reads cross the prophage boundary in one piece and
              // which are split at it.
              linkedReads: 'normal',
              height: 210,
            },
            {
              trackId: 'ecoli_pggb_depth',
              type: 'LinearWiggleDisplay',
              height: 100,
            },
            // The MAF the graph induces, over the same window (review: "a maf
            // track of the different species in the graph if there is rgfa or
            // maf available"). There is: ecoli_pggb_maf, the same track
            // pangenome/maf draws whole-genome. Here it is the third independent
            // statement of one event -- the reads' deletion, the depth track's
            // 5 -> 1 step, and now the four non-K12 rows going blank across
            // exactly the prophage. Each comes from a different file and none of
            // them is the others' summary.
            { trackId: 'ecoli_pggb_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    // gate on the pileup actually having drawn, not on the locus text: the
    // testid flips only once model.canvasDrawn is true, so a missing or empty
    // BAM fails the capture instead of quietly yielding a blank lane. readyText
    // on the window would have matched before a single read rendered.
    readySelector: displayReady('pileup-display'),
    readyTimeout: 120000,
    viewportWidth: 1000,
    // gene lane + the pileup with its coverage band + the depth wiggle + the
    // MAF's five rows and its coverage band
    viewportHeight: 865,
    settleMs: 20000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
]
