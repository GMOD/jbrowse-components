import { displayReady, sessionSpec } from '../screenshot-spec-helpers.ts'
import { ECOLI_DEMO_BASE } from './demoBase.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the Minigraph-Cactus pangenome tutorial (pangenome_cactus.md).
// They load the same hosted ecoli_pangenome demo config as the pggb figures
// (specs/pangenome.ts), whose ecoli_cactus_* tracks are the Minigraph-Cactus
// projections of the same five strains, as a bare ?config= against the local
// build. Every projection is anchored on the K12 reference, so each is a plain
// LinearGenomeView on K12 (the synteny one stacks all five). Remote demo data →
// generous settle.
//
// Through ECOLI_DEMO_BASE like the pggb specs, rather than the hosted URL
// written out, so a rebuilt-but-not-yet-uploaded demo renders these figures too.
// Same default, so it changes no committed image.
const CONFIG = encodeURIComponent(`${ECOLI_DEMO_BASE}/config.json`)

// The odgi viz raster's own path rows, in its order and its colors, sampled out
// of the committed graph.png. K12 is absent on purpose — in a K12-anchored view
// it is the coordinate line, not a row.
const ODGI_PATH_COLORS = [
  { name: 'CFT073', color: 'rgb(163,68,151)' },
  { name: 'IAI39', color: 'rgb(114,190,79)' },
  { name: 'NCTC86', color: 'rgb(200,132,51)' },
  { name: 'Sakai', color: 'rgb(164,163,56)' },
]

export const pangenomeCactusSpecs: ScreenshotSpec[] = [
  // Projection 1: all-vs-all synteny (halSynteny from the HAL). The four strains
  // stacked K12 -> NCTC86, one halSynteny ribbon per adjacent pair. K12/Sakai/
  // CFT073 read as clean colinear diagonals; CFT073<->NCTC86 crosses in an X
  // because NCTC86 is assembled in the opposite orientation, the same inversion
  // the pggb graph and the odgi viz raster report.
  {
    mode: 'url',
    name: 'pangenome_cactus/synteny',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          // IAI39 last, matching the pggb figure: the first four rows are the
          // near-colinear backbone and the bottom band is the only one showing
          // rearrangement, so the crossings are attributable to one strain.
          views: [
            { assembly: 'K12' },
            { assembly: 'Sakai' },
            { assembly: 'CFT073' },
            { assembly: 'NCTC86' },
            { assembly: 'IAI39' },
          ],
          tracks: [
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
            ['ecoli_cactus_ava'],
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

  // The two builders' depth curves in one frame, which is the comparison both
  // pangenome pages assert in prose ("the same five strains and the same
  // projections onto K12") and neither showed.
  //
  // ONE MultiQuantitativeTrack rather than two QuantitativeTracks, with
  // minScore/maxScore pinned. Two separate wiggle lanes each autoscale to their
  // own max, so pggb's plateau would draw at half height against its 0-10 axis
  // and Cactus's at full height against its 0-5, and the figure would say the
  // opposite of the truth. One track on one fixed axis is the only honest shape.
  //
  // THE LOCUS IS READ OFF THE DATA, not chosen. bigWigToBedGraph on both
  // published bigWigs, then the windows where pggb exceeds the strain count:
  // the two sustained plateaus are chr:3,941,000-3,947,000 and
  // chr:4,166,000-4,171,500, which are the rrnC and rrnB operons. Over
  // chr:3,935,000-3,955,000, which frames the first with flanks:
  //   pggb    min 4.81  max 9.98  mean 6.28   (40 windows)
  //   cactus  min 3.89  max 4.00  mean 3.97   (39 windows)
  // The pggb curve doubles over the operon and the Cactus curve does not move at
  // all. Whole-chromosome the two are near-identical walls (means 4.48 and 4.36)
  // and 4.6 Mb over 1000px puts nine 500bp windows in a pixel, so the spikes
  // aggregate away — that framing was tried first and showed nothing.
  //
  // The same operon is the subject of the pggb tutorial's untangle figure
  // (chr:3,941,447-3,946,786), so the collapse reads twice: as several query
  // segments landing on one reference span there, and as doubled depth here.
  //
  // Session tracks, not the config's own ecoli_*_depth tracks, because the two
  // have to land in one multiwiggle to share the axis. Absolute URIs: session
  // tracks do not inherit the config's baseUri.
  {
    mode: 'url',
    name: 'pangenome_cactus/builders',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'ecoli_depth_by_builder',
          name: 'Pangenome depth over K12, by builder (odgi depth)',
          assemblyNames: ['K12'],
          adapter: {
            type: 'MultiWiggleAdapter',
            subadapters: [
              {
                type: 'BigWigAdapter',
                name: 'pggb',
                bigWigLocation: {
                  uri: `${ECOLI_DEMO_BASE}/ecoli_pggb_depth.bw`,
                  locationType: 'UriLocation',
                },
              },
              {
                type: 'BigWigAdapter',
                name: 'Minigraph-Cactus',
                bigWigLocation: {
                  uri: `${ECOLI_DEMO_BASE}/ecoli_cactus_depth.bw`,
                  locationType: 'UriLocation',
                },
              },
            ],
          },
          displays: [
            {
              type: 'MultiLinearWiggleDisplay',
              displayId: 'ecoli_depth_by_builder-display',
              // 0 to twice the strain count, fixed, so the two rows are directly
              // comparable and the doubling is half the row rather than a full
              // one. Autoscale would rescale each row to its own max and erase
              // the only thing the figure is about.
              minScore: 0,
              maxScore: 10,
            },
          ],
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:3,935,000-3,955,000',
          // the operon named on the figure, not in the caption alone
          // (reviewer: "unclear why pggb depth is higher, need reasoning in
          // caption and even in-figure annotations"). Same span as the pggb
          // tutorial's untangle figure, so the collapse is the same object in
          // both. A band, not an overlay arrow: it is a genomic interval, and
          // it lands on the two depth rows as well as on the genes.
          highlight: [
            {
              refName: 'chr',
              start: 3941447,
              end: 3946786,
              assemblyName: 'K12',
              label: 'rrnC operon: the copies pggb collapses',
            },
          ],
          showHighlightChips: true,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            {
              trackId: 'ecoli_depth_by_builder',
              type: 'MultiLinearWiggleDisplay',
              // two rows at 150px: the doubling is 2x the plateau, so a row has
              // to be tall enough for that ratio to read.
              height: 300,
            },
          ],
        },
      ],
    }),
    readySelector: displayReady('multi-wiggle-display'),
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the gene lane plus the whole 300px two-row stack, with room for the
    // bottom row's 0 tick (640 left it on the frame edge)
    viewportHeight: 690,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 3: the graph's whole-genome alignment (the HAL) projected onto K12
  // as a MAF. Coverage band on top, one row per strain (K12 first), colored where
  // each differs from K12. A shared-backbone window, so mismatches read as SNP
  // divergence.
  {
    mode: 'url',
    name: 'pangenome_cactus/maf',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:800,000-806,000',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            { trackId: 'ecoli_cactus_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    readyText: '806,000',
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

  // The JBrowse half of the odgi-viz correspondence pair: the same locus the
  // banded raster (pangenome_cactus/graph.png) shades, in the same paint, so a
  // reader can carry the band from one figure to the other. It was three loci in
  // three colors, which is three comparisons to make where one carries the whole
  // point.
  //
  // The coordinates are pinned to the pinned graph (fixed RefSeq accessions +
  // pinned cactus image, see build_ecoli_pangenome_cactus.sh) and were picked by
  // walking the graph's own K12 path: chr:1,000,000-1,100,000 is the 100 kb K12
  // window spanning the most PANGENOME sequence. That is the whole point of the
  // pair — 2.2% of the K12 axis, ~4.3% of the graph's, same locus, because one
  // axis counts K12 bases and the other counts pangenome bases.
  //
  // The partner track is the odgi pav rows, not the aggregate depth wiggle it
  // used to be (reviewer: the correspondence with odgi viz was unreadable). odgi
  // viz IS per-path presence rows — one row per path, painted where the path is
  // there and white where it is not — so the JBrowse panel is built to be the
  // same picture: the same four non-reference strains, in the raster's own row
  // order, each in the color odgi gave it, sampled straight out of graph.png. A
  // blue depth wall shares no channel with that raster; these rows share all
  // three (row, color, white gap), and the ONE thing that differs, the x axis,
  // is what the pair is about.
  //
  // K12 has no row here because K12 is the axis: the raster's K12#0#chr row is
  // this view's coordinate line.
  {
    mode: 'url',
    name: 'pangenome_cactus/graph_correspondence',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        {
          type: 'MultiQuantitativeTrack',
          trackId: 'ecoli_cactus_pav_odgi_colors',
          name: 'MC graph: per-strain presence (odgi pav, vs K12)',
          assemblyNames: ['K12'],
          adapter: {
            type: 'MultiWiggleAdapter',
            // Row order and colors are the raster's, read off graph.png itself
            // rather than guessed: CFT073 magenta, IAI39 green, NCTC86 orange,
            // Sakai olive, top to bottom, minus the K12 row.
            subadapters: ODGI_PATH_COLORS.map(({ name, color }) => ({
              type: 'BigWigAdapter',
              name,
              color,
              bigWigLocation: {
                uri: `https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus_pav_${name}.bw`,
                locationType: 'UriLocation',
              },
            })),
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          highlight: [
            // Gold, and explicitly alpha'd: getHighlightColor uses a supplied
            // color AS-IS, so a bare hex paints an opaque bar over the rows it
            // is meant to point at. Gold because the same wash has to read over
            // the raster's saturated rows on white and over these.
            {
              refName: 'chr',
              start: 1000000,
              end: 1100000,
              color: 'rgba(255,193,7,0.60)',
            },
          ],
          tracks: [
            {
              trackId: 'ecoli_cactus_pav_odgi_colors',
              type: 'MultiLinearWiggleDisplay',
              // density, not xy: odgi viz paints presence as a filled band, and
              // a 0/1 signal drawn as a bar chart is the same band with ragged
              // edges. Pinning the domain to 0-1 keeps every present base fully
              // saturated instead of shaded by an autoscaled maximum.
              defaultRendering: 'multirowdensity',
              minScore: 0,
              maxScore: 1,
              // four rows at the raster's own 40px-per-row scale
              height: 160,
            },
          ],
        },
      ],
    }),
    readyText: 'per-strain presence',
    readyTimeout: 90000,
    // 1040 CSS px captures at 2080, the odgi raster's exact width, so the two
    // figures stack cleanly in the docs at the same scale
    viewportWidth: 1040,
    viewportHeight: 380,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 990, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },

  // Projection 4: the two odgi projections in one whole-chromosome view — the
  // aggregate depth curve (odgi depth) over the per-strain presence rows (odgi
  // pav). They were two figures; alone, the depth wiggle is a solid blue wall
  // that says nothing about WHICH strain is missing, which is exactly what the
  // rows below it answer, so one dip and its explanation now sit in one frame.
  {
    mode: 'url',
    name: 'pangenome_cactus/pav',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          tracks: [
            {
              trackId: 'ecoli_cactus_depth',
              type: 'LinearWiggleDisplay',
              height: 150,
            },
            {
              trackId: 'ecoli_cactus_pav',
              type: 'MultiLinearWiggleDisplay',
              // 4 strains at 60px a row, enough for the accessory dips to read
              // without the stack dominating the frame
              height: 240,
            },
          ],
        },
      ],
    }),
    readyText: 'per-strain presence',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // fits the 150px depth track plus the whole 240px stack
    viewportHeight: 640,
    settleMs: 15000,
    hideTooltip: true,
    actions: [
      { type: 'hover', from: { x: 950, y: 60 } },
      { type: 'delay', ms: 2000 },
    ],
  },
]
