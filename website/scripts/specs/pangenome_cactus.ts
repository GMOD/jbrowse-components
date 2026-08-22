import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  PARK_CURSOR,
  displayReady,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'
import {
  ECOLI_AVA_STACK_HEIGHT,
  ECOLI_DEMO_BASE,
  ecoliAvaStack,
} from './demoBase.ts'
import {
  CARRIAGE_DISPLAY,
  TOOLBAR_READY,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'

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

// The graph-as-a-graph figure loads the K12-only graphgenomeview fixture rather
// than the demo config the projections above use, for the reason every other
// graph figure does: that fixture pins the plugin bundle by content hash, so the
// view cannot change this image without a diff in this repo. The two lanes and
// the graph all read the hosted ecoli_cactus index, which the demo config
// carries as `ecoli_cactus_segments` and build_ecoli_pangenome_cactus.sh writes.
//
// WHAT THAT PIN DOES NOT COVER is the path a reader takes: the demo config, its
// own unpinned plugin url, and the track declared there rather than in a session
// spec. Checked by rendering this spec once with GRAPH_CONFIG swapped for CONFIG
// and the session tracks dropped, which drew the same 161 nodes and 214 edges
// off the config's own `ecoli_cactus_segments` (2026-08-13). Re-run it that way
// after a demo redeploy; it is not committed as a figure of its own, because a
// second near-identical image would churn on every plugin publish and the sweep
// is not a gate anyway.
const GRAPH_CONFIG = local('test_data/graphgenomeview/config.json')

const MC_SEGMENTS_TRACK = 'ecoli_cactus_segments'
const MC_SEGMENTS_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: MC_SEGMENTS_TRACK,
  name: 'MC graph: segments (whole graph, by locus)',
  assemblyNames: ['K12'],
  adapter: {
    type: 'RgfaTabixAdapter',
    uri: `${ECOLI_DEMO_BASE}/ecoli_cactus`,
  },
}

// The same index a second time, for the carriage lane: one track per coloring,
// because a display's color is a track-level setting and the figure wants both
// readings of the same segments in one frame.
const MC_CARRIAGE_TRACK = 'ecoli_cactus_carriage'
const MC_CARRIAGE_SESSION_TRACK = {
  ...MC_SEGMENTS_SESSION_TRACK,
  trackId: MC_CARRIAGE_TRACK,
  name: 'MC graph: segment carriage',
}

const K12_GENES_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: 'K12_genes',
  name: 'K12 genes',
  assemblyNames: ['K12'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: { uri: `${ECOLI_DEMO_BASE}/K12.gff.gz` },
    index: { location: { uri: `${ECOLI_DEMO_BASE}/K12.gff.gz.tbi` } },
  },
}

// THE LOCUS IS READ OFF THE INDEX, not chosen by eye. Scanning
// ecoli_cactus.segs.bed.gz for contiguous runs carried by K12 alone
// (`SM:Z:K12.0`) and keeping the short ones gives a handful of candidates; this
// is the one whose anchors both sit inside a 2 kb window, so the bubble closes
// in frame instead of running off it.
//
// Segment 258914 is `K12#0#chr:1,978,494-1,979,270`, 776 bp, K12 only. The
// segments either side of it carry all five strains, and ecoli_cactus.links
// .bed.gz holds one link straight from the left anchor to the right one: the
// other four walk that edge and skip the 776 bp. The window is the flhDC
// flagellar operon's downstream edge and the insertion is annotated insB5/insA5,
// an IS1 transposase pair, which is what the gene lane names.
//
// Nodes in the cut: 115 backbone plus ~60 off-backbone, which is the legible end
// of the range measured on the pggb graph (1 kb / ~150 nodes legible, 3 kb / 519
// a braid). A Minigraph-Cactus graph caps segments at 1024 bp, so the private
// stretch is one node rather than a chain, which is why it draws as a single
// long tube.
const IS1_WINDOW = 'chr:1,978,100-1,979,700'
const IS1_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1978100,
  end: 1979700,
}
const IS1_HIGHLIGHT = {
  refName: 'chr',
  start: 1978494,
  end: 1979270,
  color: 'rgba(214,137,16,0.13)',
}

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
  // The graph itself, which every projection above is a flattening of: the
  // segments lane over a 2 kb K12 window, and under it the subgraph the track
  // menu's Launch view cuts from that same window. Both read the two tabix
  // indexes build_pggb_tabix.sh writes over mc/ecoli.gfa.gz, so a block in the
  // lane and a node below it are the same segment.
  //
  // Same reference-position ramp in both halves, over the cut's own region, so
  // the correspondence is by hue rather than by counting along. Genes grey for
  // the reason local_subgraph gives: at the default goldenrod the gene boxes
  // read as more graph nodes.
  //
  // Force-directed, because the subject is the SHAPE — one long tube with the
  // rest of the graph passing it — and an anchored layout draws that arm flat
  // against the backbone it parallels.
  {
    mode: 'url',
    name: 'pangenome_cactus/graph_bubble',
    url: sessionSpec(GRAPH_CONFIG, {
      sessionTracks: [
        K12_GENES_SESSION_TRACK,
        MC_SEGMENTS_SESSION_TRACK,
        MC_CARRIAGE_SESSION_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: IS1_WINDOW,
          // where the private stretch starts and stops, which is the one thing
          // the lane cannot say on its own: at this width its blocks are a row
          // of ticks and the long one reads as any other block
          highlight: [IS1_HIGHLIGHT],
          tracks: [
            {
              trackId: 'K12_genes',
              type: 'LinearBasicDisplay',
              height: 60,
              color: 'rgb(130,130,130)',
              // Genes only, which is what the lane is called. The GFF also
              // carries the IS1's own `mobile_genetic_element` record over
              // nearly the same span, and it has no Name, so it drew as the
              // widest box in the lane labelled `id-NC_000913.3:1978503
              // ..1979270`. insB5 is that element's transposase and is named,
              // so nothing in the frame is lost with it gone.
              jexlFiltersSetting: ["jexl:feature.type=='gene'"],
            },
            {
              trackId: MC_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              displayMode: 'collapsed',
              height: 40,
              color: referencePositionColor(IS1_REGION),
            },
            // The same segments again, colored by how many strains walk each.
            // Without it the frame shows a route past the long node and says
            // nothing about who takes it, and "the other four skip it" would be
            // a claim living only in the caption. Here the private stretch is
            // the one red block, against the grey the rest of the window is,
            // and the legend names the scale.
            {
              trackId: MC_CARRIAGE_TRACK,
              type: 'LinearBasicDisplay',
              displayMode: 'collapsed',
              // the lane itself is one row; the height is what the five-entry
              // legend needs, and at 40 it drew two of them
              height: 90,
              ...CARRIAGE_DISPLAY,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: MC_SEGMENTS_TRACK,
          loadedRegion: IS1_REGION,
          layoutMode: 'force',
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    settleMs: 4000,
    viewportWidth: 1000,
    // GraphGenomeView takes no `height` through the launch snapshot; the pane
    // sizes itself to its drawing, and this force drawing is a long diagonal
    // thread with the bubble at one end, so it is taller than it is wide. Sized
    // off the run's own CONTENT CLIPPED BELOW THE FOLD rather than off the PNG.
    viewportHeight: 1160,
    hideTooltip: true,
    // The one thing this drawing gets read backwards (review: "the 'deletion
    // loop' is very large ... larger than the insertions, which is
    // counterintuitive"). The dashed edge is a single link between the two
    // flanking anchors and holds no bases at all; in a force layout its drawn
    // length is a spring at rest, so it bows out around the tube it bypasses and
    // ends up the biggest thing in the frame. The app labels it with the length
    // it SKIPS, which is the length of the tube inside it -- so the two are the
    // same 776 bp drawn twice, once as sequence and once as a route past it.
    //
    // A callout rather than a layout change: `auto` would rank the nodes by
    // reference position and draw the link as a short arc, which reads right and
    // loses what this figure is for (see the note above -- the anchored layout
    // flattens the K12-only arm against the backbone it parallels).
    annotations: [
      {
        type: 'text',
        text: 'The dashed edge is one link and carries no sequence. How far it bows out is the force layout, not a length -- the bases it skips are the tube it goes around.',
        fontSize: 18,
        maxWidth: 420,
        textAlign: 'start',
        anchor: {
          selector: '[data-testid="graph-genome-canvas"]',
          alignX: 'left',
          alignY: 'top',
          dx: 300,
          dy: 30,
        },
      },
    ],
  },

  // Projection 1: all-vs-all synteny (halSynteny from the HAL). The four strains
  // stacked K12 -> NCTC86, one halSynteny ribbon per adjacent pair. K12/Sakai/
  // CFT073 read as clean colinear diagonals; CFT073<->NCTC86 crosses in an X
  // because NCTC86 is assembled in the opposite orientation, the same inversion
  // the pggb graph and the odgi viz raster report.
  {
    mode: 'url',
    name: 'pangenome_cactus/synteny',
    url: sessionSpec(CONFIG, {
      views: [ecoliAvaStack('ecoli_cactus_ava')],
    }),
    viewportHeight: ECOLI_AVA_STACK_HEIGHT,
    readySelector: displayPainted('synteny_canvas'),
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
    // 1200 rather than 1000: the two callouts below sit in the right flank, and
    // at 1000 a pill wide enough to hold a sentence starts on top of the plateau
    // it is explaining. The extra 200px go into the flanks, since the operon is
    // a fixed number of bases in the middle.
    viewportWidth: 1200,
    // the gene lane plus the whole 300px two-row stack, with room for the
    // bottom row's 0 tick (640 left it on the frame edge)
    viewportHeight: 690,
    settleMs: 15000,
    hideTooltip: true,
    actions: [PARK_CURSOR, { type: 'delay', ms: 2000 }],
    // One callout per row, saying why THAT row does what it does (reviewer:
    // "consider adding red annotation text boxes to both to explain why this
    // happened to each"). The band already names the operon and the caption
    // already explains path steps; what neither says on the image is that the
    // two rows differ because of what the builder did with the copies, which is
    // the whole figure.
    //
    // Both sit in the right flank, anchored to the track and to a K12
    // coordinate rather than to a measured pixel, and `textAlign: 'end'` ends
    // each pill at the same place — the pill's own width is only known once the
    // text is measured in the page. They are drawn over the flat part of each
    // curve on purpose: a pill is opaque, and the flank is a wall of one value,
    // so it covers no shape. fracY is a fraction of the 300px track, i.e. 0.25
    // is the middle of the upper row and 0.75 the middle of the lower one.
    //
    // One clause each, naming the operation. They were three sentences apiece —
    // the mechanism spelled out on the image (reviewer: "the red callouts are a
    // little wordy ... use technical terminology if it helps"), which is what a
    // caption is for. `collapses`/`keeps each copy at its own offset` is the
    // whole difference between the two builders, and the pair of curves under
    // them is the evidence.
    //
    // "which tool is correct?" (later review) is deliberately NOT a third pill.
    // The answer is neither -- the two builders were asked different questions
    // and each curve is right about its own graph -- and that is a paragraph,
    // which is what the caption and the prose under it now carry. A pill saying
    // "neither" over one of the two rows would read as being about that row.
    annotations: [
      {
        type: 'text',
        text: 'seqwish collapses the copies onto one run of nodes',
        maxWidth: 430,
        fontSize: 16,
        textAlign: 'end',
        anchor: {
          track: 'ecoli_depth_by_builder',
          locus: 'chr:3,954,300',
          fracY: 0.12,
        },
      },
      {
        type: 'text',
        text: 'Minigraph-Cactus keeps each copy at its own offset',
        maxWidth: 430,
        fontSize: 16,
        textAlign: 'end',
        anchor: {
          track: 'ecoli_depth_by_builder',
          locus: 'chr:3,954,300',
          fracY: 0.62,
        },
      },
    ],
  },

  // Projection 3: the graph's whole-genome alignment (the HAL) projected onto K12
  // as a MAF. Coverage band on top, one row per strain (K12 first), colored where
  // each differs from K12.
  //
  // THE WINDOW CARRIES THE NEGATIVE, which is why it is not the shared-backbone
  // 6 kb it used to be. There every row aligned across the whole frame, so the
  // caption said "all five align continuously" and the paragraph under it had to
  // send the reader to the PGGB PAGE for the case a row drops out — the one
  // thing the coverage band exists to separate, documented on a different page
  // from the figure that should show it.
  //
  // This is the K12 cryptic prophage CPZ-55, the same element pangenome/long_reads
  // opens on the pggb build: K12 carries it and the other four skip it, so the
  // four rows stop dead at its edges while K12's runs through, and the coverage
  // band steps down over exactly that span. Both readings of a blank row are then
  // in one frame — uncolored where a strain matches K12, absent where it has no
  // alignment at all.
  {
    mode: 'url',
    name: 'pangenome_cactus/maf',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:2,554,007-2,570,007',
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay' },
            { trackId: 'ecoli_cactus_maf', type: 'LinearMafDisplay' },
          ],
        },
      ],
    }),
    readyText: '2,570,007',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 480,
    settleMs: 15000,
    hideTooltip: true,
    actions: [PARK_CURSOR, { type: 'delay', ms: 2000 }],
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
    actions: [PARK_CURSOR, { type: 'delay', ms: 2000 }],
  },

  // `pangenome_cactus/pav` was here and is DELETED. It drew the aggregate odgi
  // depth curve over the per-strain presence rows for the whole chromosome, and
  // the pggb tutorial's `pangenome/pav` draws the identical composition from the
  // identical odgi commands -- this section's own prose opens by saying so
  // ("the same commands ... only the path names differ").
  //
  // The one place the two builders disagree is the rRNA operons, and that has
  // its own figure: `pangenome_cactus/builders` puts both curves on one fixed
  // axis over the banded operon, where the difference is legible. At
  // whole-chromosome scale it is two spikes. So the comparative figure keeps the
  // comparison and this one kept only the restatement.
]

// WHAT THE SUBGRAPH TOUR TYPES INTO THE PASTE BOX, and it is
// `pangenome_cactus.md`'s own "Indexing the graph" fence character for character
// (check-paste-configs). The two are one text: change the fence and change this
// in the same commit.
//
// The url is the hosted pair rather than ECOLI_DEMO_BASE, because the page
// prints the hosted one -- it used to print the bare `ecoli_cactus` prefix the
// build writes, which is a config nothing can resolve until the reader has run
// cactus, and so a config no film could paste.
export const CACTUS_SEGMENTS_TRACK_JSON = `{
  "type": "FeatureTrack",
  "trackId": "ecoli_cactus_segments",
  "name": "MC graph: segments (whole graph, by locus)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus"
  },
  "displayDefaults": { "showLabels": false }
}`

// The window the tour opens on, before it narrows to IS1_WINDOW. A Minigraph-
// Cactus graph is coarser than a pggb one, so the same 12 kb is ~800 K12
// segments where the density gate is one per pixel, and the lane still arrives
// dense enough that narrowing to the bubble is the point of the narrowing.
const CACTUS_TOUR_WINDOW = 'chr:1,972,900-1,984,900'

// What website/scripts/videos/pangenome.ts films. The tour opens the same
// fixture config and the same gene lane the graph figure above does, and lands
// on the same IS1 window, so the clip and the figure are one locus.
export const cactusVideoFixtures = {
  config: GRAPH_CONFIG,
  genesTrack: K12_GENES_SESSION_TRACK,
  segmentsTrackId: MC_SEGMENTS_TRACK,
  segmentsTrackJson: CACTUS_SEGMENTS_TRACK_JSON,
  tourWindow: CACTUS_TOUR_WINDOW,
  locusWindow: IS1_WINDOW,
}
