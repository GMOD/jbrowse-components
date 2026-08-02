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

// hg38's primary chromosomes, in order, for the whole-genome arc view. The
// assembly is the full GRCh38 with alts and random scaffolds, and laying those
// out too spends most of the width on contigs no fusion call touches.
const HG38_MAIN_CHROMS = [
  ...Array.from({ length: 22 }, (_, i) => `chr${i + 1}`),
  'chrX',
  'chrY',
  // 16 kb against 3.1 Gb, so it is a hairline, but ten of the 44 calls end on
  // it, and those arcs are the artefact tail the figure is about
  'chrM',
]

export const cancerSvSpecs: ScreenshotSpec[] = [
  // The event as the reference shows it: every spanning read is torn into four
  // pieces, so the pileup is a wall of clipping at two points 457 bp apart, and
  // the matched normal underneath is flat. That contrast is what makes the call
  // somatic rather than a mapping artefact.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_tumour_vs_normal',
    viewportHeight: 860,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // tight enough that both chr3 breakpoints (25,359,111 and 25,359,568) sit
      // near the middle rather than against the right edge
      loc: 'chr3:25,357,600-25,361,000',
      tracks: [
        GENE_TRACK,
        { trackId: SV, height: 70 },
        // soft-clipped tails are the whole signal here: with clipping hidden the
        // tumour pileup looks as flat as the normal
        {
          trackId: TUMOUR,
          showSoftClipping: true,
          height: 270,
          ...SUPER_COMPACT,
        },
        {
          trackId: NORMAL,
          showSoftClipping: true,
          height: 150,
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
    viewportHeight: 1130,
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
            { loc: HOPS.rarb, readHeight: 250, geneHeight: 60 },
            { loc: HOPS.bicc1, readHeight: 130, geneHeight: 60 },
            // the chr12 window is the one that clears a gene's 5' end, so it
            // stacks TRHDE over TRHDE-AS1 and needs the second row
            { loc: HOPS.trhde, readHeight: 140, geneHeight: 100 },
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

  // The same reconstruction at the scale of the stitching. Zoomed onto the
  // ~900 bp where the three junctions sit, the two templated inserts stop being
  // hairlines and become ribbons the same width as the chr3 arms flanking them.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_inserts',
    viewportHeight: 940,
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
              tracks: ['hg38-ReferenceSequenceTrack'],
            },
            {
              assembly: 'der3_RARB_BICC1_TRHDE',
              loc: 'der3_RARB_BICC1_TRHDE:32,300-33,400',
              tracks: [
                'der3_segments',
                'der3_RARB_BICC1_TRHDE-ReferenceSequenceTrack',
              ],
            },
          ],
          tracks: [['der3_vs_hg38']],
          drawCurves: true,
          levelHeights: [300],
        },
      ],
    }),
  },

  // The check on the reconstruction. Realigned against the derivative the same
  // reads run straight through all three junctions at flat depth, with no
  // clipping at the joins -- which is only true if the contig is right.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_proof',
    viewportHeight: 900,
    url: lgvSession(CONFIG, {
      assembly: 'der3_RARB_BICC1_TRHDE',
      loc: 'der3_RARB_BICC1_TRHDE:32,400-33,500',
      tracks: ['der3_segments', { trackId: 'reads_vs_der3', height: 500 }],
    }),
  },

  // K562: the caller's whole output at once. Every call is an arc from its left
  // breakpoint to its right, so the two reciprocal chr9<->chr22 calls (BCR--ABL1
  // and NUP214--XKR3, the Philadelphia translocation from both sides) cross the
  // frame while the artefact tail sits on chrM at the right edge.
  //
  // The arcs need the whole genome laid out, not a window: an arc is only drawn
  // when *both* endpoints resolve through `view.bpToPx`, so in a single-locus
  // view every interchromosomal call is silently dropped and the track renders
  // as a lone breakend glyph (which is what this figure used to show).
  {
    mode: 'url',
    name: 'cancer_sv/k562_starfusion_triage',
    viewportHeight: 500,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      displayedRegionNames: HG38_MAIN_CHROMS,
      tracks: [
        {
          trackId: 'K562_star_fusion',
          type: 'LinearPairedArcDisplay',
          height: 280,
          // triage is the point of the figure, so the support level has to be
          // visible: StarFusionAdapter puts JunctionReadCount on the feature's
          // score, and three calls clear 100 against a tail in single digits.
          // Two of them are the chr9<->chr22 pair and paint as the one red arc;
          // the third (BAG6--SLC44A4) spans 0.21 Mb, under a pixel here, and
          // Arcs.tsx drops any arc whose radius is <= 1px
          color: "jexl:get(feature,'score') > 100 ? '#c62828' : '#9e9e9e'",
        },
      ],
    }),
  },

  // BCR on the left, ABL1 on the right, Iso-Seq reads bridging them. The
  // right-hand panel starts at the base STAR-Fusion called from short reads.
  {
    mode: 'url',
    name: 'cancer_sv/k562_bcr_abl_split',
    viewportHeight: 1010,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          displayName: 'BCR (chr22) - ABL1 (chr9)',
          views: [
            {
              assembly: 'hg38',
              loc: 'chr22:23,285,000-23,295,000',
              tracks: [
                { trackId: GENES, height: 90 },
                // Iso-Seq reads are mostly intron line: at the default height a
                // panel is a stack of near-empty rows, and the reads that
                // actually cross the junction are spread over hundreds of px
                { trackId: 'K562_isoseq', height: 260, ...COMPACT },
              ],
            },
            {
              assembly: 'hg38',
              loc: 'chr9:130,850,000-130,860,000',
              tracks: [
                { trackId: GENES, height: 90 },
                { trackId: 'K562_isoseq', height: 260, ...COMPACT },
              ],
            },
          ],
        },
      ],
    }),
  },

  // The fusion is not merely present, it is amplified: chr9q34 sits at ~7 copies
  // against flanking sequence at ~1, and the step lands on the junction.
  {
    mode: 'url',
    name: 'cancer_sv/k562_cn_amplicon',
    viewportHeight: 600,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr9:129,500,000-132,000,000',
      tracks: [GENES, 'K562_cn', 'K562_star_fusion'],
    }),
  },
]
