import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the somatic structural variation tutorial (cancer_sv.md).
//
// Two datasets, both hosted under demos/cancer_sv:
//   COLO829 / COLO829BL  melanoma tumour + matched normal, ONT R10 genomic long
//                        reads streamed from the ONT open-data bucket, with the
//                        wf-somatic-variation SV calls and the derivative allele
//                        that scripts/sv_multihop.py reconstructs from them
//   K562                 ENCODE PacBio Iso-Seq plus DepMap's STAR-Fusion calls
//                        and copy-number segments, for the transcript-level view
//
// Point CANCER_SV_BASE at a local `npx serve` of the build output to render
// figures before the demo data is uploaded:
//
//   npx --yes serve -l 8099 --cors cancer_sv_build/demo
//   CANCER_SV_BASE=http://localhost:8099 node scripts/generate-screenshots.ts \
//     --filter cancer_sv
export const CANCER_SV_BASE =
  process.env.CANCER_SV_BASE ?? 'https://jbrowse.org/demos/cancer_sv'

const CONFIG = encodeURIComponent(`${CANCER_SV_BASE}/config.json`)

// The three loci the RARB/BICC1/TRHDE chain joins. Every panel that shows the
// event is built from this one list so a coordinate can't drift between figures.
const HOPS = {
  rarb: 'chr3:25,352,000-25,362,000',
  bicc1: 'chr10:58,715,000-58,720,000',
  trhde: 'chr12:72,271,000-72,276,000',
}

const GENES = 'ncbi_refseq_hg38'
const TUMOUR = 'COLO829_tumor_ont'
const NORMAL = 'COLO829BL_normal_ont'
const SV = 'COLO829_somatic_sv'

// Super-compact reads (COMPACTNESS_PRESETS' featureHeight 1 / featureSpacing 0).
// ONT depth here is 200x tumour / 80x normal, and at the default read height a
// panel shows a dozen rows out of that; the reads carrying the junction are
// below the fold. One row per pixel puts the whole pileup in frame, which is
// what makes the wall of clipping legible as a wall.
const SUPER_COMPACT = { featureHeight: 1, featureSpacing: 0 }

// The two halves of cancer_sv/multihop_reads: the evidence at one breakpoint and
// the chain across all three loci, side by side rather than a screen of figure
// each. `+append` needs them the same height, but not the same width, so the
// tumour/normal half takes the narrower one: a 3.4 kb window with two pileups in
// it says what it has to say in less page than the three-locus chain does.
const MULTIHOP_HEIGHT = 885
const MULTIHOP_WIDTH = 940
const MULTIHOP_NARROW_WIDTH = 660

// The Compact preset (featureHeight 3 / featureSpacing 0). K562's Iso-Seq is
// ~600x over BCR, and at one row per pixel that many reads merge into a solid
// block; three keeps individual transcripts separable while still fitting an
// order of magnitude more of the pileup than the default.
const COMPACT = { featureHeight: 3, featureSpacing: 0 }

// Every COLO829 window in this tutorial falls inside a large intron (RARB,
// BICC1, TRHDE), where the gene track draws one flat line per isoform and no
// exon. Collapsing to the longest coding transcript is what makes the gene NAME
// visible: a top-level feature's floating label is drawn under its glyph and
// reserves no height of its own, so with all isoforms stacked the label lands
// past the bottom of a fixed-height track and is clipped away (verified against
// the live model: the label was in floatingLabelsData at y=313 under a track
// 100px tall). One row puts it back inside the band.
const GENE_TRACK = {
  trackId: GENES,
  geneGlyphMode: 'longestCoding',
  height: 60,
}

// hg38's primary chromosomes, in order, for the whole-genome views. The
// assembly is the full GRCh38 with alts and random scaffolds, and laying those
// out too spends most of the circle on contigs no fusion call touches.
const HG38_MAIN_CHROMS = [
  ...Array.from({ length: 22 }, (_, i) => `chr${i + 1}`),
  'chrX',
  'chrY',
  // 16 kb against 3.1 Gb, so it is a hairline, but ten of the 44 calls end on
  // it, and those arcs are the artefact tail the figure is about
  'chrM',
]

// Triage is the point of the whole-callset figure, so the support level has to
// be visible: StarFusionAdapter puts JunctionReadCount on the feature's score,
// and three calls clear 100 against a tail in single digits.
const FUSION_ARC_COLOR =
  "jexl:get(feature,'score') > 100 ? '#c62828' : '#9e9e9e'"

export const cancerSvSpecs: ScreenshotSpec[] = [
  // The event as the reference shows it: every spanning read is torn into four
  // pieces, so the pileup is a wall of clipping at two points 457 bp apart, and
  // the matched normal underneath is flat. That contrast is what makes the call
  // somatic rather than a mapping artefact.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_tumour_vs_normal',
    // this and multihop_split_view are the two halves of
    // cancer_sv/multihop_reads, which +appends them, so the two share a HEIGHT;
    // this half is the narrower of the two
    viewportHeight: MULTIHOP_HEIGHT,
    viewportWidth: MULTIHOP_NARROW_WIDTH,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // tight enough that both chr3 breakpoints (25,359,111 and 25,359,568) sit
      // near the middle rather than against the right edge
      loc: 'chr3:25,357,600-25,361,000',
      tracks: [
        // no gene track: this window is deep inside RARB's first intron, so the
        // glyph is a line with arrows on it, and the three-locus half of the
        // composed figure already names every gene
        { trackId: SV, height: 60 },
        // soft-clipped tails are the whole signal here: with clipping hidden the
        // tumour pileup looks as flat as the normal.
        //
        // Each track is the size of its own pileup at one row per pixel, and
        // MULTIHOP_HEIGHT is set from the total: a taller track here is blank
        // page under the reads rather than more of them.
        {
          trackId: TUMOUR,
          showSoftClipping: true,
          height: 350,
          ...SUPER_COMPACT,
        },
        {
          trackId: NORMAL,
          showSoftClipping: true,
          height: 190,
          ...SUPER_COMPACT,
        },
      ],
    }),
  },

  // The same three loci side by side. Reads that leave one panel arrive in the
  // next, so the chain can be followed panel to panel instead of inferred from
  // breakend brackets.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_split_view',
    viewportHeight: MULTIHOP_HEIGHT,
    viewportWidth: MULTIHOP_WIDTH,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          displayName: 'RARB (chr3) - BICC1 (chr10) - TRHDE (chr12)',
          // `views`, not `init`: the LaunchView handler a session spec goes
          // through takes the panel list flat, while `init` is the
          // config/defaultSession form
          //
          // Read-track heights follow each locus's depth (chr3 is the 200x
          // primary tumour window, the two hops are 60-70x), so a panel is the
          // size of its own pileup rather than 250px of white under a short one.
          views: [
            { loc: HOPS.rarb, readHeight: 140, geneHeight: 45 },
            { loc: HOPS.bicc1, readHeight: 75, geneHeight: 50 },
            // the chr12 window is the one that clears a gene's 5' end, so it
            // stacks TRHDE over TRHDE-AS1 and needs the second row
            { loc: HOPS.trhde, readHeight: 85, geneHeight: 75 },
          ].map(({ loc, readHeight, geneHeight }) => ({
            assembly: 'hg38',
            loc,
            tracks: [
              { ...GENE_TRACK, height: geneHeight },
              { trackId: TUMOUR, height: readHeight, ...SUPER_COMPACT },
            ],
          })),
        },
      ],
    }),
  },

  // The two above as one figure, since they are one event twice: the reads clip
  // at the chr3 breakpoint on the left, and the panels on the right are where
  // the clipped halves went. Side by side rather than stacked, because they are
  // alternative views of the same locus rather than steps of a procedure, and
  // because two screens of pileup down a tutorial page is a lot of page.
  {
    mode: 'compose',
    name: 'cancer_sv/multihop_reads',
    parts: [
      'cancer_sv/multihop_tumour_vs_normal',
      'cancer_sv/multihop_split_view',
    ],
    direction: 'horizontal',
  },

  // The reconstruction: the derivative contig on the bottom row against the
  // three reference loci on the top. The two templated inserts are 199 bp and
  // 183 bp, so they are thin ribbons between two thick chr3 arms -- the second
  // of which runs backwards, which is the foldback.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_synteny',
    viewportHeight: 950,
    viewportWidth: 1600,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          displayName: 'Reconstructed derivative allele vs hg38',
          views: [
            {
              assembly: 'hg38',
              // space-separated locstrings put all three loci in one panel, so
              // every ribbon has a target. A single chr3 window would leave the
              // two templated inserts -- the whole point of the figure --
              // pointing at nothing.
              loc: 'chr3:25325000-25361000 chr10:58716500-58718500 chr12:72272000-72274500',
              // deliberately no gene track: all three windows fall inside large
              // introns, so the glyph is a bare line with arrows either side of
              // a sliver of TRHDE, which costs a track row and says nothing
              tracks: [SV],
            },
            {
              assembly: 'der3_RARB_BICC1_TRHDE',
              loc: 'der3_RARB_BICC1_TRHDE:1-39,549',
              // the provenance track carries what the gene track cannot: which
              // reference interval each stretch of the contig came from
              tracks: ['der3_segments', 'reads_vs_der3'],
            },
          ],
          tracks: [['der3_vs_hg38']],
          drawCurves: true,
          levelHeights: [200],
        },
      ],
    }),
  },

  // The same reconstruction at the scale of the stitching, and the check on it
  // in the same frame. Zoomed onto the ~900 bp where the three junctions sit,
  // the two templated inserts stop being hairlines and become ribbons the same
  // width as the chr3 arms flanking them; the realigned reads under those
  // segments run straight through every join at flat depth, which is only true
  // if the contig is right.
  //
  // The reads are what a separate figure used to carry on its own. Realigned
  // depth means nothing without the segment boundaries to read it against, and
  // those boundaries are this figure, so the two belong in one frame.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_inserts',
    viewportHeight: 1240,
    viewportWidth: 1600,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          displayName: 'Two templated inserts join the chr3 arms',
          views: [
            {
              assembly: 'hg38',
              loc: 'chr3:25358900-25359700 chr10:58717380-58717740 chr12:72273040-72273360',
              // the genes each junction lands in, named. All three windows are
              // deep inside an intron, so the glyphs are lines rather than exon
              // stacks, but they answer which gene each piece was taken from
              // without the reader going back to the text
              tracks: [
                { ...GENE_TRACK, height: 55 },
                'hg38-ReferenceSequenceTrack',
              ],
            },
            {
              assembly: 'der3_RARB_BICC1_TRHDE',
              loc: 'der3_RARB_BICC1_TRHDE:32,300-33,400',
              tracks: [
                'der3_segments',
                'der3_RARB_BICC1_TRHDE-ReferenceSequenceTrack',
                // default read height, not the super-compact preset the
                // reference-side pileups use: 29 spanning reads is a stack that
                // fits, and one row per pixel would draw them as hairlines
                { trackId: 'reads_vs_der3', height: 260 },
              ],
            },
          ],
          tracks: [['der3_vs_hg38']],
          drawCurves: true,
          levelHeights: [220],
        },
      ],
    }),
  },

  // K562: the caller's whole output at once, as chords on a circle. Every call
  // is a chord from its left breakpoint to its right, so the two reciprocal
  // chr9<->chr22 calls (BCR--ABL1 and NUP214--XKR3, the Philadelphia
  // translocation from both sides) cross the middle in red while the artefact
  // tail runs into chrM.
  //
  // Circular rather than a whole-genome linear view: laid out linearly the same
  // 44 arcs all bow the same way and overlap into a single grey mat, and the
  // ones worth reading are the tall ones, which are also the ones most
  // overdrawn. On a circle a chord's length is its span and the crossings sit in
  // the middle, away from the chromosome names.
  {
    mode: 'url',
    name: 'cancer_sv/k562_starfusion_triage',
    viewportHeight: 900,
    viewportWidth: 1100,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'CircularView',
          assembly: 'hg38',
          displayedRegionNames: HG38_MAIN_CHROMS,
          // the circle auto-fits its container, so this is the drawing's size
          height: 820,
          tracks: [
            { trackId: 'K562_star_fusion', strokeColor: FUSION_ARC_COLOR },
          ],
        },
      ],
    }),
  },

  // BCR beside ABL1 in one row, the way FusionInspector lays a fusion out: two
  // displayed regions in a single view rather than two stacked panels, each
  // window centred on its own STAR-Fusion breakpoint and banded there. Iso-Seq
  // coverage is the thing to read: it steps down at the BCR band and up at the
  // ABL1 band, so the transcript's exons come from BCR up to the junction and
  // from ABL1 after it.
  //
  // One level rather than a breakpoint split view: that view stacks the partners
  // and draws a spline per read between them, and at ~600x Iso-Seq depth the
  // bundle of splines covers both pileups.
  {
    mode: 'url',
    name: 'cancer_sv/k562_bcr_abl_split',
    viewportHeight: 780,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr22:23,286,000-23,293,000 chr9:130,851,000-130,858,000',
      // the two breakpoints the DepMap STAR-Fusion call reports for BCR--ABL1,
      // one band each, so the coverage step has a marked position to sit on
      highlight: [
        { refName: 'chr22', start: 23_290_313, end: 23_290_513 },
        { refName: 'chr9', start: 130_853_964, end: 130_854_164 },
      ],
      tracks: [
        { ...GENE_TRACK, height: 90 },
        // Iso-Seq reads are mostly intron line: at the default read height the
        // pileup is a stack of near-empty rows, so it takes the smaller share
        // here and the coverage band takes the rest
        {
          trackId: 'K562_isoseq',
          height: 400,
          coverageHeight: 220,
          ...COMPACT,
        },
      ],
    }),
  },

  // Where the amplified copies came from: chr22q11 beside chr9q34, one region
  // each, with the fusion calls drawn as arcs across the pair. Both regions step
  // up in copy number, and the arcs land on the two steps' inner edges, so the
  // amplified unit is the piece of chr22 plus the piece of chr9 the junctions
  // join, not either chromosome on its own.
  //
  // Two regions rather than the chr9 window alone: an arc is only drawn when
  // both of its endpoints resolve through `view.bpToPx`, so with chr9 by itself
  // the copy-number step has nothing pointing at it and the figure asserts the
  // link in its caption instead of showing it.
  {
    mode: 'url',
    name: 'cancer_sv/k562_cn_amplicon',
    viewportHeight: 780,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr22:16,700,000-16,950,000 chr9:130,600,000-131,350,000 chr22:23,150,000-23,400,000',
      tracks: [
        { ...GENE_TRACK, height: 70 },
        { trackId: 'K562_cn', height: 130 },
        {
          trackId: 'K562_star_fusion',
          type: 'LinearPairedArcDisplay',
          height: 290,
          color: FUSION_ARC_COLOR,
        },
      ],
    }),
  },
]
