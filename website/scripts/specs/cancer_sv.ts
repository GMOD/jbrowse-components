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

export const cancerSvSpecs: ScreenshotSpec[] = [
  // The event as the reference shows it: every spanning read is torn into four
  // pieces, so the pileup is a wall of clipping at two points 457 bp apart, and
  // the matched normal underneath is flat. That contrast is what makes the call
  // somatic rather than a mapping artefact.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_tumour_vs_normal',
    viewportHeight: 1100,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // tight enough that both chr3 breakpoints (25,359,111 and 25,359,568) sit
      // near the middle rather than against the right edge
      loc: 'chr3:25,357,600-25,361,000',
      tracks: [
        GENES,
        SV,
        // soft-clipped tails are the whole signal here: with clipping hidden the
        // tumour pileup looks as flat as the normal
        { trackId: TUMOUR, showSoftClipping: true, height: 320 },
        { trackId: NORMAL, showSoftClipping: true, height: 260 },
      ],
    }),
  },

  // The same three loci side by side. Reads that leave one panel arrive in the
  // next, so the chain can be followed panel to panel instead of inferred from
  // breakend brackets.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_split_view',
    viewportHeight: 1460,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          displayName: 'RARB (chr3) - BICC1 (chr10) - TRHDE (chr12)',
          // `views`, not `init`: the LaunchView handler a session spec goes
          // through takes the panel list flat, while `init` is the
          // config/defaultSession form
          views: [
            { assembly: 'hg38', loc: HOPS.rarb, tracks: [GENES, TUMOUR] },
            { assembly: 'hg38', loc: HOPS.bicc1, tracks: [GENES, TUMOUR] },
            { assembly: 'hg38', loc: HOPS.trhde, tracks: [GENES, TUMOUR] },
          ],
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

  // K562: the caller's whole output at once. Two calls tower over the rest and
  // the tail is mitochondrial noise, which is the triage the arc display exists
  // for.
  {
    mode: 'url',
    name: 'cancer_sv/k562_starfusion_triage',
    viewportHeight: 470,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr22:23,180,000-23,320,000',
      tracks: [GENES, 'K562_star_fusion'],
    }),
  },

  // BCR on the left, ABL1 on the right, Iso-Seq reads bridging them. The
  // right-hand panel starts at the base STAR-Fusion called from short reads.
  {
    mode: 'url',
    name: 'cancer_sv/k562_bcr_abl_split',
    viewportHeight: 1020,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          displayName: 'BCR (chr22) - ABL1 (chr9)',
          views: [
            {
              assembly: 'hg38',
              loc: 'chr22:23,285,000-23,295,000',
              tracks: [GENES, 'K562_isoseq'],
            },
            {
              assembly: 'hg38',
              loc: 'chr9:130,850,000-130,860,000',
              tracks: [GENES, 'K562_isoseq'],
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
