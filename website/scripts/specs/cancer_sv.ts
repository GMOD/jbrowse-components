import { SPLIT_VIEW_MENU_LABEL } from '../../../plugins/variants/src/LinearVariantDisplay/labels.ts'
import { lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'
import { DER3_GENES_TRACK } from './cancer_sv_der3_genes.ts'
import { pageTrack } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for cancer_sv.md (COLO829) and k562_fusions.md (k562_*). To render
// before the demo data is uploaded, serve the build output and point
// CANCER_SV_BASE at it:
//
//   npx --yes serve -l 8099 --cors cancer_sv_build/demo
//   CANCER_SV_BASE=http://localhost:8099 node scripts/generate-screenshots.ts \
//     --filter cancer_sv
export const CANCER_SV_BASE =
  process.env.CANCER_SV_BASE ?? 'https://jbrowse.org/demos/cancer_sv'

const CONFIG = `${CANCER_SV_BASE}/config.json`

const GENES = 'ncbi_refseq_hg38'
const TUMOUR = 'COLO829_tumor_ont'
const NORMAL = 'COLO829BL_normal_ont'
const SV = 'COLO829_somatic_sv'

// One row per pixel fits the whole 200x ONT pileup in frame.
const SUPER_COMPACT = { mark: { height: 1 } }

// Both COLO829 ONT pileups exceed the byte gate at every window here, since an
// ONT read is 20 kb of fetch; without forceLoad each figure captures the
// "Requested too much data" banner.
const DEEP_ONT = { forceLoad: true }

const TRUTH_SET_TRACK = pageTrack('tutorials/cancer_sv.md', 'COLO829_truth_set')
const TRUTH_SET = TRUTH_SET_TRACK.trackId

// `+append` pads the shorter half, so each half keeps its measured height.
const MULTIHOP_HEIGHT = 1126
const MULTIHOP_CHAIN_HEIGHT = 1188
const MULTIHOP_WIDTH = 1000

// Per panel. Below 70 the chr12 panel's second gene row clips its label.
const MULTIHOP_GENE_HEIGHT = 70

// K562 Iso-Seq leaves ~250 split-read rows over BCR, and a 2px row is a
// hairline a reader cannot follow across the join. Raising this needs a taller
// lane, or the rows go behind the track's own scrollbar, which no size report
// sees.
const SPLIT_READS = { mark: { height: 4 } }

// Every COLO829 window sits inside an intron. With all isoforms stacked, the
// gene name's floating label falls below the fixed track height and clips.
const GENE_TRACK = {
  trackId: GENES,
  geneGlyphMode: 'longestCoding',
  height: 60,
}

// Step badge for staged figures. Radius 26 stays legible after a 2700 px strip
// is scaled to a doc column.
const FLOW_NUMBER = (n: number, extra?: { view: [number, number] }) =>
  ({
    type: 'circle',
    text: String(n),
    radius: 26,
    fontSize: 30,
    anchor: {
      ...extra,
      trackId: SV,
      fracY: 0,
      alignX: 'left',
      dx: 34,
      dy: 34,
    },
  }) as const

// cancer_sv/realigned_reads: one junction (chr3:25,359,568, derivative 32,732)
// against hg38 and against derive's allele.
//
// The reference pane needs the chr12 panel: without it, connectors that skip
// the chr12 insert draw dashed. It needs 5 kb a panel: at 380 bp a connector
// with one end off-panel draws as a diagonal comb.
//
// The derivative pane stays at 380 bp; past ~1 kb it fills with clipped tails
// of reads that never cross the junction.
//
// BreakpointSplitView's `init` drops a per-panel `highlight`, so only the
// derivative pane draws the band.
const JUNCTION_HL_DER3 = {
  refName: 'der3_RARB_BICC1_TRHDE',
  start: 32722,
  end: 32742,
  color: 'rgba(60,65,72,0.12)',
}

function realignedReadsPartSpecs(): ScreenshotSpec[] {
  // Shared by both panes. The derivative rows are sized to meet the split
  // view's height; neither size report sees an overflow inside a track.
  const HEIGHT = 833
  const WIDTH = 700
  // chr10 and chr12 draw only the reads whose tails land there, so they get
  // shorter tracks than chr3.
  const BREAKPOINT_READS = {
    trackId: TUMOUR,
    ...DEEP_ONT,
    pileup: {
      softClips: { show: true },
      // At 1px the rows fuse into a grey slab with white streaks.
      mark: { height: 2 },
    },
    // Split reads only: otherwise connectors leave rows packed below the
    // visible band and draw as diagonal ladders with no read at either end.
    filter: [{ field: 'split', equal: true }],
  }
  return [
    {
      mode: 'url',
      name: 'cancer_sv/realigned_reads_reference',
      viewportHeight: HEIGHT,
      viewportWidth: WIDTH,
      url: sessionSpec(CONFIG, {
        views: [
          {
            type: 'BreakpointSplitView',
            displayName: 'RARB (chr3) - BICC1 (chr10) - TRHDE (chr12)',
            // The view lays its panels out inside `height` and scrolls them, so
            // a taller track needs a taller view. The launcher takes panels
            // flat as `views` and rejects `init`.
            height: 800,
            // In the order the reads cross them, so connector bundles join
            // adjacent panels.
            views: [
              {
                assembly: 'hg38',
                loc: 'chr3:25,357,000-25,362,000',
                tracks: [{ ...BREAKPOINT_READS, height: 280 }],
              },
              {
                assembly: 'hg38',
                loc: 'chr10:58,715,000-58,720,000',
                tracks: [{ ...BREAKPOINT_READS, height: 150 }],
              },
              {
                assembly: 'hg38',
                loc: 'chr12:72,270,700-72,275,700',
                tracks: [{ ...BREAKPOINT_READS, height: 150 }],
              },
            ],
          },
        ],
      }),
      readySelector: `[data-testid="${TUMOUR}-loaded"]`,
      // Decoding the ONT CRAM on a CI runner exceeds 120000 every time.
      readyTimeout: 300000,
      annotations: [
        {
          type: 'circle',
          text: '1',
          anchor: { view: [0, 0], trackId: TUMOUR, fracY: 0, alignX: 'left' },
          radius: 15,
          dx: 24,
          dy: 78,
        },
        {
          type: 'text',
          text: 'aligned to hg38',
          // Both panels show TUMOUR; `view: [0, 0]` picks the upper one.
          anchor: {
            view: [0, 0],
            trackId: TUMOUR,
            fracY: 0,
            alignX: 'left',
            dx: 10,
            dy: 30,
          },
        },
      ],
    },
    {
      mode: 'url',
      name: 'cancer_sv/realigned_reads_derivative',
      viewportHeight: HEIGHT,
      viewportWidth: WIDTH,
      url: lgvSession(CONFIG, {
        assembly: 'der3_RARB_BICC1_TRHDE',
        loc: 'der3_RARB_BICC1_TRHDE:32,545-32,925',
        highlight: [JUNCTION_HL_DER3],
        tracks: [
          { trackId: 'der3_segments', height: 70 },
          {
            trackId: 'reads_vs_der3',
            pileup: {
              softClips: { show: true },
              // 43 reads overlap this window (29 span all four junctions). At a
              // pitch of featureHeight + 1 they need 387 of the 425 px under
              // the coverage band; at 11 the pileup ran onto a scrollbar.
              mark: { height: 8 },
            },
            height: 470,
          },
        ],
      }),
      readyText: '32,5',
      readyTimeout: 90000,
      // A longer label wraps over the track header.
      annotations: [
        {
          type: 'circle',
          text: '2',
          anchor: { trackId: 'reads_vs_der3', fracY: 0, alignX: 'left' },
          radius: 15,
          dx: 24,
          dy: 78,
        },
        {
          type: 'text',
          text: 'realigned to the derived contig',
          anchor: {
            trackId: 'reads_vs_der3',
            fracY: 0,
            alignX: 'left',
            dx: 10,
            // Below 30 the ~44px pill covers the track name.
            dy: 30,
          },
        },
      ],
    },
  ]
}

export const cancerSvSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'cancer_sv/multihop_tumour_vs_normal',
    viewportHeight: MULTIHOP_HEIGHT,
    viewportWidth: MULTIHOP_WIDTH,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr3:25,357,600-25,361,000',
      tracks: [
        // No gene track: this window is deep inside RARB's first intron. Below
        // 130 the second breakend's record clips behind the track's scrollbar.
        { trackId: SV, height: 130 },
        // Each height is its 2px-row pileup plus coverage, measured; a miss
        // leaves blank inside the track, which no size report sees.
        {
          trackId: TUMOUR,
          ...DEEP_ONT,
          pileup: { softClips: { show: true }, mark: { height: 2 } },
          height: 470,
        },
        {
          trackId: NORMAL,
          ...DEEP_ONT,
          pileup: { softClips: { show: true }, mark: { height: 2 } },
          height: 215,
        },
      ],
    }),
    annotations: [
      {
        type: 'text',
        text: `Right-click a breakend → ${SPLIT_VIEW_MENU_LABEL}`,
        fontSize: 17,
        maxWidth: 260,
        leader: true,
        anchor: { selector: '[data-testid="feature-name-r_12_1"]' },
        dx: -30,
        dy: 95,
      },
    ],
  },

  // The three loci are walkBreakendChain's answer from the chr3 record, as
  // walkBreakendChain.test.ts asserts.
  {
    mode: 'url',
    name: 'cancer_sv/multihop_split_view',
    viewportWidth: MULTIHOP_WIDTH,
    viewportHeight: MULTIHOP_CHAIN_HEIGHT,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'BreakpointSplitView',
          displayName: 'RARB (chr3) - BICC1 (chr10) - TRHDE (chr12)',
          views: [
            'chr3:25,354,568-25,364,568',
            'chr10:58,712,464-58,722,464',
            'chr12:72,268,294-72,278,294',
          ].map(loc => ({
            assembly: 'hg38',
            loc,
            tracks: [
              { ...GENE_TRACK, height: MULTIHOP_GENE_HEIGHT },
              {
                trackId: TUMOUR,
                ...DEEP_ONT,
                pileup: { ...SUPER_COMPACT, softClips: { show: true } },
                height: 160,
              },
            ],
          })),
        },
      ],
    }),
    readySelector: `[data-testid="${TUMOUR}-loaded"]`,
    readyTimeout: 300000,
    tooltip: 'hide',
  },

  {
    mode: 'compose',
    name: 'cancer_sv/multihop_reads',
    parts: [
      'cancer_sv/multihop_tumour_vs_normal',
      'cancer_sv/multihop_split_view',
    ],
    columns: 2,
    annotations: [
      {
        type: 'arrow',
        strokeWidth: 10,
        fromAnchor: { selector: '[data-part="0"]', alignX: 'right', dx: -160 },
        anchor: { selector: '[data-part="1"]', alignX: 'left', dx: 100 },
      },
    ],
  },

  // A synteny panel splits its width by bp, so every bp of zoom comes out of
  // chr3.
  //
  // No realigned-read lane on the allele: 18 of its 29 reads split at
  // derivative 32,275, where the inverted copy of chr3 begins, and count bases
  // twice left of it.
  {
    mode: 'url',
    name: 'cancer_sv/derivative_synteny',
    viewportHeight: 990,
    viewportWidth: 1600,
    url: sessionSpec(CONFIG, {
      sessionTracks: [DER3_GENES_TRACK, TRUTH_SET_TRACK],
      views: [
        {
          type: 'LinearSyntenyView',
          displayName: 'Reconstructed derivative allele vs hg38',
          views: [
            {
              assembly: 'hg38',
              trackLabels: 'overlapping',
              loc: 'chr3:25350000-25363000 chr10:58716500-58718500 chr12:72272000-72274500',
              highlight: [
                {
                  refName: 'chr3',
                  assemblyName: 'hg38',
                  label: 'junctions',
                  start: 25358000,
                  end: 25360600,
                },
                {
                  refName: 'chr3',
                  assemblyName: 'hg38',
                  label: 'not in the allele',
                  start: 25360600,
                  end: 25363000,
                  color: 'rgba(60,65,72,0.10)',
                },
              ],
              tracks: [
                {
                  ...GENE_TRACK,
                  displayMode: 'compact',
                  height: 50,
                },
                { trackId: TRUTH_SET, displayMode: 'collapsed', height: 30 },
                {
                  trackId: TUMOUR,
                  ...DEEP_ONT,
                  filter: [{ field: 'split', equal: true }],
                  unit: 'chain',
                  pileup: { connectors: { show: true }, mark: { height: 3 } },
                  coverage: { height: 30 },
                  readConnections: { show: true, height: 110 },
                  heightMode: 'grow',
                  height: 200,
                  legend: { show: true },
                },
              ],
            },
            {
              assembly: 'der3_RARB_BICC1_TRHDE',
              // The same total span as the row above, so the ribbons run
              // near-vertical.
              loc: 'der3_RARB_BICC1_TRHDE:22,000-39,549',
              trackLabels: 'offset',
              tracks: [
                {
                  trackId: 'der3_segments',
                  displayMode: 'compact',
                },
                {
                  ...GENE_TRACK,
                  trackId: DER3_GENES_TRACK.trackId,
                  displayMode: 'compact',
                  height: 74,
                },
              ],
            },
          ],
          tracks: [['der3_vs_hg38']],
          mark: { interpolate: 'bump' },
          encoding: { color: 'reference' },
          levelHeights: [88],
        },
      ],
    }),
    annotations: [
      {
        type: 'text',
        anchor: {
          view: [0, 1],
          trackId: DER3_GENES_TRACK.trackId,
          fracY: 0,
          alignX: 'left',
          dx: 40,
          dy: 20,
        },
        text: 'fold-back',
        fontSize: 18,
        maxWidth: 900,
      },
      {
        type: 'text',
        text: 'reads cross twice',
        fontSize: 17,
        maxWidth: 380,
        leader: true,
        anchor: {
          view: [0, 0],
          trackId: TUMOUR,
          loc: 'chr3:25,356,000',
          fracY: 0.5,
        },
        dx: -140,
        dy: 65,
      },
    ],
  },
  {
    mode: 'url',
    name: 'cancer_sv/derivative_inserts',
    viewportHeight: 1445,
    viewportWidth: 1600,
    url: sessionSpec(CONFIG, {
      sessionTracks: [DER3_GENES_TRACK, TRUTH_SET_TRACK],
      views: [
        {
          type: 'LinearSyntenyView',
          displayName: 'Two templated inserts join the chr3 arms',
          views: [
            {
              assembly: 'hg38',
              // Each window extends past its junction so a tear does not read
              // as a crop. Wider than this closes up the chr3 window's two
              // junctions, 457 bp apart.
              loc: 'chr3:25358500-25360100 chr10:58717200-58717920 chr12:72272880-72273520',
              tracks: [
                { ...GENE_TRACK, displayMode: 'compact', height: 55 },
                { trackId: TRUTH_SET, displayMode: 'collapsed', height: 30 },
                // No soft clipping: clipped ONT tails fill the chr3 window with
                // mismatch hash.
                {
                  trackId: TUMOUR,
                  ...DEEP_ONT,
                  filter: [{ field: 'split', equal: true }],
                  unit: 'chain',
                  pileup: {
                    // Chain mode joins only pieces that straddle two panels;
                    // connectors adds the inverted and hidden-segment joins
                    // inside one panel.
                    connectors: { show: true },
                    mark: { height: 5 },
                  },
                  coverage: {
                    // The filter runs before coverage, so this band counts the
                    // split subset, not tumour depth; the caption says so.
                    show: true,
                    height: 40,
                  },
                  readConnections: {
                    show: true,
                  },
                  // 5px rows: at 1px the 28 connectors merge into one purple
                  // smear. 'grow' because a fixed height ignores featureHeight
                  // while fitting.
                  heightMode: 'grow',
                  height: 170,
                  // The legend names the two connector families. FloatingLegend
                  // pins top-right, over the chr12 window's first rows.
                  legend: { show: true },
                },
              ],
            },
            {
              assembly: 'der3_RARB_BICC1_TRHDE',
              loc: 'der3_RARB_BICC1_TRHDE:32,300-33,400',
              // The projected CDS has no reading frame, since a junction can
              // cut a codon.
              showAminoAcids: false,
              tracks: [
                'der3_segments',
                {
                  ...GENE_TRACK,
                  trackId: DER3_GENES_TRACK.trackId,
                  displayMode: 'compact',
                  height: 95,
                },
                // 15 of the 46 records here are secondary. flagExclude drops
                // them and `unit: 'chain'` merges split segments, leaving 28
                // rows at a pitch of 9. A quality fade on the mismatches
                // changes nothing on this Q30-Q50 R10 BAM.
                {
                  trackId: 'reads_vs_der3',
                  // The same pitch as the hg38 lane, since the figure compares
                  // the two.
                  heightMode: 'grow',
                  height: 175,
                  pileup: { mark: { height: 5 } },
                  coverage: {
                    // The flat realigned depth that the tutorial's prose cites.
                    height: 40,
                  },
                  unit: 'chain',
                  filter: [{ field: 'flags.SECONDARY', equal: false }],
                },
              ],
            },
          ],
          tracks: [['der3_vs_hg38']],
          mark: { interpolate: 'bump' },
          // Below 140 the two insert ribbons meet inside the crossings.
          levelHeights: [140],
        },
      ],
    }),
    annotations: [
      {
        type: 'text',
        text: 'validated calls, where the reads stop',
        fontSize: 17,
        leader: true,
        dx: 80,
        anchor: {
          view: [0, 0],
          trackId: TRUTH_SET,
          loc: 'chr3:25,359,568',
          fracY: 0.5,
        },
      },
      {
        type: 'text',
        text: 'hg38, three source loci',
        fontSize: 19,
        anchor: {
          view: [0, 0],
          trackId: GENES,
          loc: 'chr3:25,358,800',
          fracY: 0.75,
        },
      },
      {
        type: 'text',
        text: 'the derivative allele',
        fontSize: 19,
        // On the gene lane: on the reads lane the pill is taller than the lane.
        anchor: {
          view: [0, 1],
          trackId: 'der3_genes',
          alignX: 'left',
          dx: 10,
          fracY: 0.95,
        },
      },
    ],
  },

  // The route is the BND record's right-click menu. An SA tag holds each
  // COLO829 ONT read's partner, so the read menu has no mate item. r_12_1 is
  // the junction cancer_sv/realigned_reads shows.
  {
    mode: 'url',
    name: 'cancer_sv/split_view_from_breakend',
    viewportWidth: 900,
    // The blank-below report measures the page under a centred dialog and is
    // wrong here; 771 comes from the clipped-below report.
    viewportHeight: 771,
    columns: 3,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr3:25,359,318-25,359,818',
      tracks: [
        { trackId: SV, height: 130 },
        { trackId: TUMOUR, height: 300, pileup: SUPER_COMPACT, ...DEEP_ONT },
      ],
    }),
    readyText: '25,359',
    // The COLO829 CRAM failed every CI sweep at 90000.
    readyTimeout: 300000,
    stages: [
      {
        // A viewport coordinate landed on the overview ruler, which navigates.
        actions: [
          {
            type: 'rightclick',
            selector: '[data-testid="feature-name-r_12_1"]',
          },
          { type: 'waitForText', text: SPLIT_VIEW_MENU_LABEL },
          { type: 'delay', ms: 1000 },
        ],
        annotations: [
          FLOW_NUMBER(1),
          { type: 'box', anchor: { text: SPLIT_VIEW_MENU_LABEL } },
        ],
      },
      {
        actions: [
          { type: 'click', text: SPLIT_VIEW_MENU_LABEL },
          { type: 'waitForText', text: 'Window size (bp)' },
          { type: 'delay', ms: 1000 },
        ],
        annotations: [
          FLOW_NUMBER(2),
          {
            type: 'box',
            anchor: { text: 'Follow further breakends at each end' },
          },
        ],
      },
      {
        // A session, so the live link opens the result. The three panels are
        // walkBreakendChain's stops, as walkBreakendChain.test.ts asserts; the
        // lane heights fit three panels into the frame height the step frames
        // share.
        url: sessionSpec(CONFIG, {
          views: [
            {
              type: 'BreakpointSplitView',
              displayName: 'RARB (chr3) - BICC1 (chr10) - TRHDE (chr12)',
              views: [
                {
                  assembly: 'hg38',
                  loc: 'chr3:25,354,568-25,364,568',
                  tracks: [
                    { trackId: SV, height: 40 },
                    {
                      trackId: TUMOUR,
                      height: 50,
                      pileup: SUPER_COMPACT,
                      ...DEEP_ONT,
                    },
                  ],
                },
                {
                  assembly: 'hg38',
                  loc: 'chr10:58,712,464-58,722,464',
                  tracks: [
                    { trackId: SV, height: 40 },
                    {
                      trackId: TUMOUR,
                      height: 50,
                      pileup: SUPER_COMPACT,
                      ...DEEP_ONT,
                    },
                  ],
                },
                {
                  assembly: 'hg38',
                  loc: 'chr12:72,268,294-72,278,294',
                  tracks: [
                    { trackId: SV, height: 40 },
                    {
                      trackId: TUMOUR,
                      height: 50,
                      pileup: SUPER_COMPACT,
                      ...DEEP_ONT,
                    },
                  ],
                },
              ],
            },
          ],
        }),
        readySelector: `[data-testid="${TUMOUR}-loaded"]`,
        annotations: [FLOW_NUMBER(3, { view: [0, 0] })],
      },
    ],
  },

  ...realignedReadsPartSpecs(),
  {
    mode: 'compose',
    name: 'cancer_sv/realigned_reads',
    parts: [
      'cancer_sv/realigned_reads_reference',
      'cancer_sv/realigned_reads_derivative',
    ],
    columns: 2,
  },

  // K562's STAR-Fusion calls in the SV inspector. A search for "chr9" leaves
  // BCR--ABL1 and NUP214--XKR3, the only calls naming chr9. The inspector's
  // chord track has no color slot, so support shows only in JunctionReadCount.
  {
    mode: 'url' as const,
    name: 'cancer_sv/k562_fusion_inspector_form',
    viewportHeight: 390,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          displayName: 'Add → SV inspector, File Type → STAR-Fusion',
          assembly: 'hg38',
          fileType: 'STAR-Fusion',
          height: 620,
        },
      ],
    }),
    formAssembly: true,
    readyText: 'Open from track',
    readyTimeout: 60000,
  },
  ...(
    [
      [
        'cancer_sv/k562_fusion_inspector_all',
        undefined,
        'All 44 STAR-Fusion calls',
      ],
      [
        'cancer_sv/k562_fusion_inspector_pair',
        'chr9',
        'Search "chr9": two chr9-chr22 junctions',
      ],
    ] as const
  ).map(([name, filterText, displayName]) => ({
    mode: 'url' as const,
    name,
    viewportHeight: 700,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          displayName,
          assembly: 'hg38',
          uri: `${CANCER_SV_BASE}/K562.star-fusion.tsv`,
          // The wizard cannot infer the parser from `.tsv`.
          fileType: 'STAR-Fusion',
          filterText,
          height: 620,
        },
      ],
    }),
    readyText: 'JunctionReadCount',
    readyTimeout: 60000,
  })),
  // `unit: 'chain'` puts each NUP214--XKR3 molecule's two alignments on one
  // row. The call joins chr9 + to chr22 -, so chr22 is `[rev]` and a molecule
  // reads straight across the join.
  {
    mode: 'url' as const,
    name: 'cancer_sv/k562_fusion_inspector_reads',
    viewportHeight: 880,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      // Each window ends on its breakpoint at the seam and grows outward only;
      // growing an inner side pushes the read piles apart into a diagonal fan.
      // The panels share one bp/px, so every kb added costs fan resolution, and
      // unequal windows put the seam off-centre.
      loc: 'chr9:131,183,000-131,199,515 chr22:16,792,068-16,808,583[rev]',
      highlight: [
        { refName: 'chr9', start: 131_198_915, end: 131_199_115 },
        { refName: 'chr22', start: 16_807_983, end: 16_808_183 },
      ],
      tracks: [
        GENE_TRACK,
        {
          trackId: 'K562_star_fusion',
          // Collapsed drops labels: both records read `NUP214--XKR3` and
          // overprint at this zoom.
          displayMode: 'collapsed',
          height: 30,
        },
        {
          trackId: 'K562_isoseq',
          height: 450,
          coverage: { height: 90 },
          sashimi: {
            // Sashimi arcs read as read connections joining the wrong places.
            show: false,
          },
          pileup: { ...SPLIT_READS, connectors: { show: true } },
          readConnections: {
            show: true,
            height: 90,
          },
          filter: [
            { field: 'split', equal: true },
            { field: 'connection.offscreen', equal: false },
          ],
          unit: 'chain',
          encoding: { color: 'pairOrientation' },
          legend: { show: true },
        },
      ],
    }),
    readyText: 'K562 PacBio Iso-Seq (ENCODE)',
    readyTimeout: 120000,
    annotations: [
      {
        type: 'text' as const,
        text: 'each line is one molecule, NUP214 into XKR3',
        fontSize: 18,
        maxWidth: 250,
        anchor: {
          trackId: 'K562_isoseq',
          loc: 'chr9:131,195,200',
          fracY: 0.55,
          alignX: 'left',
          dx: 20,
        },
      },
      // In the gene lane, which is empty on the chr22 side past the seam.
      {
        type: 'text' as const,
        text: 'chr22 is flipped: its coordinates run right to left',
        fontSize: 17,
        maxWidth: 330,
        anchor: {
          trackId: GENES,
          loc: 'chr22:16,805,600',
          fracY: 0.5,
          alignX: 'left',
        },
      },
    ],
  },
  // The k562_fusion_inspector_* specs appear only as the tutorial Figure's
  // `links=`; keep them.

  // The middle window is the acceptor most BCR--ABL1 molecules reach; without
  // it they draw as one opaque tick at the BCR donor. The windows are 7 kb each
  // because an LGV shares one bp/px across regions, and a wide ABL1 window
  // shrinks BCR to a smear. `unit: 'chain'` links the SA chain (Iso-Seq is
  // single-end).
  {
    mode: 'url',
    name: 'cancer_sv/k562_bcr_abl_split',
    viewportHeight: 1140,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr22:23,286,000-23,293,000 chr9:130,778,000-130,785,000 chr9:130,851,000-130,858,000',
      // No band on the middle panel: no caller reported that acceptor.
      highlight: [
        { refName: 'chr22', start: 23_290_313, end: 23_290_513 },
        { refName: 'chr9', start: 130_853_964, end: 130_854_164 },
      ],
      tracks: [
        { ...GENE_TRACK, height: 90 },
        {
          trackId: 'K562_isoseq',
          height: 800,
          coverage: { height: 110 },
          sashimi: { show: false },
          pileup: { ...SPLIT_READS, connectors: { show: true } },
          readConnections: {
            // The donor tick for the remaining reads keeps its width:
            // `arcStrokeScale` caps at ~44 reads. DEMO_DATASETS.md has the
            // per-window counts.
            show: true,
            // At 35 the two arcs read as one mark.
            height: 90,
          },
          filter: [{ field: 'split', equal: true }],
          unit: 'chain',
          legend: { show: true },
        },
      ],
    }),
    // No RefSeq transcript has an exon under the middle panel's coverage
    // (ncbiRefSeq checked), so `longestCoding` hides nothing. Whether it is an
    // acceptor or an artefact is not established; the pill stops at the
    // annotation.
    annotations: [
      {
        type: 'text',
        text: 'each line is one molecule, BCR into ABL1',
        fontSize: 18,
        maxWidth: 250,
        anchor: {
          trackId: 'K562_isoseq',
          loc: 'chr9:130,851,100',
          fracY: 0.32,
          alignX: 'left',
          dx: 20,
        },
      },
      {
        type: 'text',
        text: 'ABL1 intron 1: coverage, no annotated exon',
        fontSize: 18,
        maxWidth: 560,
        anchor: {
          trackId: 'K562_isoseq',
          loc: 'chr9:130,778,200',
          fracY: 0,
          dy: 230,
          alignX: 'left',
          dx: 6,
        },
      },
    ],
  },

  // Paired-arc displays: at 400 bp/px a 1 bp variant box is under a pixel. The
  // bands are the three DNA breaks, 4 kb wide to survive the scale.
  {
    mode: 'url',
    name: 'cancer_sv/k562_amplicon_dna',
    viewportHeight: 620,
    viewportWidth: 1600,
    url: lgvSession(CONFIG, {
      assembly: 'hg38',
      loc: 'chr9:130,690,000-131,320,000',
      highlight: [
        { refName: 'chr9', start: 130_729_760, end: 130_733_760 },
        { refName: 'chr9', start: 131_197_198, end: 131_201_198 },
        { refName: 'chr9', start: 131_278_138, end: 131_282_138 },
      ],
      tracks: [
        GENE_TRACK,
        {
          trackId: 'K562_star_fusion',
          type: 'LinearMarkDisplay',
          height: 50,
          marks: [
            {
              mark: 'link',
              encoding: {
                x2: { refName: 'mate.refName', pos: 'mate.start' },
                color: { value: '#a65628' },
                strokeWidth: 2,
              },
              transform: [{ type: 'mate' }],
            },
          ],
        },
        {
          trackId: 'K562_10x_sv',
          type: 'LinearMarkDisplay',
          height: 50,
          marks: [
            {
              mark: 'link',
              encoding: {
                x2: { refName: 'mate.refName', pos: 'mate.start' },
                color: { value: '#a65628' },
                strokeWidth: 2,
              },
              transform: [{ type: 'mate' }],
            },
          ],
        },
        {
          trackId: 'K562_cn',
          height: 130,
          encoding: {
            y: {
              scale: { domainMin: 0, domainMax: 8 },
              axis: { title: 'copy ratio (DepMap)' },
            },
          },
        },
      ],
    }),
    readyText: 'K562 copy-number segments (DepMap WGS)',
    readyTimeout: 120000,
    annotations: [
      {
        type: 'text',
        text: 'BCR-ABL1 junction, called by STAR-Fusion from RNA-seq',
        maxWidth: 600,
        fontSize: 17,
        leader: true,
        anchor: {
          trackId: 'K562_star_fusion',
          loc: 'chr9:130,854,064',
          fracY: 0.3,
        },
        dx: 60,
        dy: 12,
      },
      {
        type: 'text',
        text: 'DNA break: copy number steps up',
        fontSize: 17,
        leader: true,
        anchor: {
          trackId: 'K562_10x_sv',
          loc: 'chr9:130,731,760',
          fracY: 0.3,
        },
        dx: 60,
        dy: 12,
      },
      {
        type: 'text',
        text: 'break to chr13, no fusion call',
        fontSize: 17,
        leader: true,
        anchor: {
          trackId: 'K562_10x_sv',
          loc: 'chr9:131,280,138',
          fracY: 0.3,
        },
        dx: -90,
        dy: 80,
      },
    ],
  },

  // A k562_cn_amplicon figure was deleted after four review rounds: no K562
  // long-read DNA or DepMap SV table exists to validate the arcs against.
]
