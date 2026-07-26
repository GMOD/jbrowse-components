import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the pangenome tutorials that use the third-party
// jbrowse-plugin-graphgenomeview (GraphGenomeView). The plugin bundle and the
// GFA fixtures are served same-origin from test_data/graphgenomeview, so the
// cross-origin plugin-trust dialog never triggers in the headless capture. The
// GFA slice is the same four-strain E. coli minigraph data the pangenome_ecoli
// tutorial builds its rGFA graph figures from.
//
// The anchored (rGFA) layout is computed locally from the SR:i:0 rank tags and
// is deterministic. The force-directed (Bandage FMMM) layout renders through the
// same pipeline — the worker resolves its WASM engine from the plugin's own
// bundle url — but is nondeterministic (~3% run-to-run drift from the OGDF force
// simulation), so its spec carries a raised diffThreshold: the committed PNG is
// only rewritten when a regen drifts past that, not on every ordinary jitter.

// Ready when the layout has landed (graph-perf-stats) AND the toolbar has
// painted. Waiting on the stats alone raced: a slow subgraph fetch could leave
// the Layout/Color selects unpainted in the captured frame, silently committing
// a figure with half a toolbar. `body:has(A) B` is an AND; a bare `A, B` list
// would be a CSS OR and fire on whichever landed first.
const TOOLBAR_READY =
  'body:has([data-testid="graph-perf-stats"]) [data-testid="graph-layout-select"]'

const CONFIG = 'test_data/graphgenomeview/config.json'
const DATA = 'https://jbrowse.org/demos/ecoli_pangenome'
const ECOLI_SEGMENTS_TRACK = 'ecoli_minigraph_segments'

// Paint the linear segments track in the graph view's own 'Stable rank (rGFA)'
// colors, so the blocks above and the nodes below are the same color for the same
// segment instead of gold-vs-blue. RgfaTabixAdapter puts the SR tag on the
// feature as `rank`, and the plugin's scheme is rank 0 -> rgb(52,152,219), then a
// ramp from rgb(237,137,44) at rank 1 to rgb(158,42,122) at the subgraph's max
// rank. Only rank 0 has reference coordinates, so a reference LGV only ever draws
// the blue backbone; the else branch is the ramp's rank-1 end, for a linear view
// opened on one of the other assemblies.
const RANK_COLOR_DEFAULTS = {
  color: "jexl:get(feature,'rank')==0?'rgb(52,152,219)':'rgb(237,137,44)'",
}

// The tutorial's own four-strain minigraph graph as an ordinary FeatureTrack,
// hoisted because several specs below launch a subgraph from it. It is a session
// track rather than a config track because the shared graphgenomeview fixture
// config carries only the K12 assembly; the two tabix indexes are hosted beside
// the GFAs. Both `RgfaTabixAdapter` and the launch menu items come from the
// plugin, so a figure that renders this track at all is also evidence the plugin
// loaded.
const ECOLI_SEGMENTS_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: ECOLI_SEGMENTS_TRACK,
  name: 'minigraph graph segments (rGFA)',
  assemblyNames: ['K12'],
  adapter: {
    type: 'RgfaTabixAdapter',
    uri: `${DATA}/ecoli_minigraph`,
  },
  displayDefaults: RANK_COLOR_DEFAULTS,
}

// The same graph read per strain instead of per segment: one row per strain,
// each block that strain's allele at one bubble, from the BED
// scripts/build_minigraph_paths.sh projects out of `minigraph --call`.
//
// `lengthField` is the point of the figure. A block can only be as wide as the
// reference it covers, so at this bubble every strain would draw the same 3,376
// bp box; the deltas turn Sakai's 113 kb allele into a labelled insertion marker
// and IAI39's into a deletion line. `rowOrder` pins the reference on top, which
// is also the pipeline's own check — K12 takes the reference path at all 601
// bubbles, so its row is uniformly grey. Class colors ride in the file's
// itemRgb, so `legend` only has to name them.
const ECOLI_PATHS_TRACK = 'ecoli_minigraph_paths'
const ECOLI_PATHS_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: ECOLI_PATHS_TRACK,
  name: 'minigraph graph: per-strain path through each bubble',
  assemblyNames: ['K12'],
  adapter: {
    type: 'BedTabixAdapter',
    uri: `${DATA}/ecoli_minigraph_paths.bed.gz`,
  },
  displays: [
    {
      type: 'LinearMultiRowFeatureDisplay',
      partitionField: 'strain',
      lengthField: 'delta',
      rowOrder: ['K12', 'Sakai', 'CFT073', 'NCTC86', 'IAI39'],
      // three strains carry an insertion at this bubble, so at the default 1 the
      // three magenta blocks abut into one mass; the gap is what makes them read
      // as three haplotypes
      rowProportion: 0.85,
      legend: [
        { label: 'reference path', color: 'rgb(204,204,204)' },
        { label: 'insertion', color: 'rgb(192,0,192)' },
        { label: 'deletion', color: 'rgb(128,128,128)' },
        { label: 'same length, different path', color: 'rgb(0,154,138)' },
        { label: 'no call', color: 'rgb(191,170,64)' },
      ],
    },
  ],
}

// The bubble the paths figure is about: K12 chr:1,094,197-1,097,573, where
// Sakai and CFT073 carry ~110-113 kb alleles, NCTC86 a 41 kb one, and IAI39
// deletes 3.2 kb. Picked off the BED, not by eye:
// `tabix ecoli_minigraph_paths.bed.gz chr:1094000-1098000`. The window is ~5x
// the bubble so the flanking reference-path blocks show it is a local event.
const PATHS_WINDOW = 'chr:1,088,000-1,104,000'

// K12's genes, so the linear half of a launch figure says which genes the
// clicked segment covers rather than being a lane of anonymous blocks. Hosted
// beside the graph indexes; the fixture config carries only the assembly.
const K12_GENES_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: 'K12_genes',
  name: 'K12 genes',
  assemblyNames: ['K12'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: { uri: `${DATA}/K12.gff.gz` },
    index: { location: { uri: `${DATA}/K12.gff.gz.tbi` } },
  },
}

// The 50 kb K12 window the launch figures work in, and a segment inside it,
// both picked from the index rather than by eye (`tabix ecoli_minigraph.segs
// .bed.gz 'K12#1#chr:4050000-4100000'`). s1277 spans 4,056,624-4,063,560 and is
// the widest segment there; it is also the only one in the window carrying a
// rank-2 (CFT073) allele, so the neighbourhood a right-click on it cuts has a
// real bubble in it instead of a straight run of backbone.
const ECOLI_WINDOW = 'chr:4,050,000-4,100,000'
const SEGMENT_LABEL = 's1277'
// ~2x the segment's own span, so its label is a comfortable right-click target
const SEGMENT_WINDOW = 'chr:4,054,000-4,066,000'

// The HPRC figures take the other route into the same view: instead of a whole
// GFA file, a GraphGenomeView carrying `loadedTrackId`/`loadedRegion` — the exact
// snapshot the "Launch view, then Graph genome view (this region)" menu item
// writes, so the figure documents the launch route rather than a second way in.
// The view cuts its subgraph from the track's own tabix indexes on attach.
const HPRC_CONFIG = 'test_data/graphgenomeview/hprc.json'
const SEGMENTS_TRACK = 'hprc_minigraph_segments'
const MHC_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 32500000,
  end: 32560000,
}

// C4, for the launch figure, from the tutorial's own table of loci worth a look.
// 70 kb fits under the view's 100 kb cap, so the visible region is launchable
// without zooming first, and the window is dense in the way the picture needs:
// `tabix hprc-v2.0-mc-grch38.links.bed.gz 'GRCh38#0#chr6:31980000-32050000'`
// gives 13 rank-0 backbone segments and 21 links out to non-reference segments
// with ranks up to 165, which is C4A/C4B copy number and the HERV insertion as
// the graph records them. AMY1, the other headline CNV locus, is 190 kb and past
// the cap.
const C4_WINDOW = 'chr6:31,980,000-32,050,000'

export const graphSpecs: ScreenshotSpec[] = [
  // The pggb subgraph, over the linear view of the same locus (reviewer: "we need
  // a linear genome view to correspond with what is shown"). A pggb GFA tags no
  // segment with a position, so there is no per-node correspondence to draw —
  // but the locus is not unknown: the file's five P lines ARE named for it, and
  // K12#1#chr:1004500-1004961 is the window the LGV above opens. The graph's five
  // paths and the MAF's five rows are the same five strains through the same
  // 461 bp, one as a bubble chain and one as an alignment.
  //
  // Layout left on 'auto'. With no rank tags to anchor to it settles into the
  // engine's own backbone inference, and that is the one setting whose result
  // reliably lands inside the view's 600px canvas — asking for 'force'
  // explicitly draws a taller layout that the auto-fit then clips. It drifts a
  // few percent between captures, hence the raised diffThreshold.
  {
    mode: 'url',
    name: 'pangenome/local_subgraph',
    url: sessionSpec(CONFIG, {
      // the shared graphgenomeview fixture config carries only the K12
      // assembly, so the pggb MAF comes in as a session track
      sessionTracks: [
        {
          type: 'MafTrack',
          trackId: 'ecoli_pggb_maf',
          name: 'pggb graph: whole-genome alignment (MAF, vs K12)',
          assemblyNames: ['K12'],
          adapter: {
            type: 'BgzipTaffyAdapter',
            samples: ['K12', 'Sakai', 'CFT073', 'NCTC86', 'IAI39'],
            tafGzLocation: { uri: `${DATA}/ecoli_pggb.taf.gz` },
            taiLocation: { uri: `${DATA}/ecoli_pggb.taf.gz.tai` },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1,004,450-1,005,010',
          tracks: [{ trackId: 'ecoli_pggb_maf', type: 'LinearMafDisplay' }],
        },
        {
          type: 'GraphGenomeView',
          gfaLocation: { uri: `${DATA}/ecoli_pggb_subgraph.gfa` },
          colorScheme: 'depth',
          // zoomToFit fits the layout to canvasHeight, and the view measures
          // that before the linear view above it has laid out — so left to
          // itself it fits to a canvas taller than the panel it ends up with
          // and the bottom of the graph is cut off. Pinned to the height the
          // panel actually gets at this viewport.
          canvasHeight: 560,
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    allowUnsettled: true,
    settleMs: 8000,
    diffThreshold: 0.1,
    viewportWidth: 1000,
    // the graph view draws into a fixed 600px canvas, so the frame has to be
    // the linear view plus that plus both headers or the layout is clipped
    viewportHeight: 950,
    hideTooltip: true,
  },
  // The indexed route on the tutorial's own four-strain graph: the rGFA
  // segments as a feature track over a 50 kb K12 window, and the subgraph the
  // launch menu cuts from that same window below it. Same two tabix indexes
  // feed both, so the segment ids above are the nodes below. The track is
  // declared in the session rather than the config because the config is the
  // shared graphgenomeview fixture; the indexes are hosted beside the GFAs.
  {
    mode: 'url',
    name: 'pangenome/rgfa_subgraph_launch',
    url: sessionSpec(CONFIG, {
      sessionTracks: [ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: ECOLI_WINDOW,
          tracks: [ECOLI_SEGMENTS_TRACK],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: {
            refName: 'chr',
            assemblyName: 'K12',
            start: 4050000,
            end: 4100000,
          },
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    settleMs: 4000,
    viewportWidth: 1000,
    // GraphGenomeView takes no `height` through the launch snapshot, and its
    // auto-fit places a wide-and-flat anchored layout low in the panel, so the
    // frame has to be tall enough to reach it
    viewportHeight: 900,
    hideTooltip: true,
  },
  // The graph read as an alignment: five haplotype rows over the bubble where
  // three strains carry a large insertion and one a deletion. The segments track
  // above is the same graph per-segment, so the two lanes are the two ways of
  // reading one file.
  {
    mode: 'url',
    name: 'pangenome/rgfa_strain_paths',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        K12_GENES_SESSION_TRACK,
        ECOLI_SEGMENTS_SESSION_TRACK,
        ECOLI_PATHS_SESSION_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PATHS_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 90 },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 100,
            },
            {
              trackId: ECOLI_PATHS_TRACK,
              type: 'LinearMultiRowFeatureDisplay',
              // five rows auto-fit into this, leaving each ~26px: taller than
              // MIN_HEIGHT_FOR_TEXT, so the insertion markers carry their bp
              // labels rather than shrinking to bare bars
              height: 130,
            },
          ],
        },
      ],
    }),
    // the multi-row display's own doneness signal: derived from fetched
    // features, so it cannot paint before the rows exist
    readySelector: '[data-testid="multirow-row-labels"]',
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    // the three pinned tracks plus both headers; at 400 the paths track, which
    // is the whole point of the figure, fell below the fold, and at 620 its last
    // row sat on the frame edge
    viewportHeight: 660,
    hideTooltip: true,
  },
  // The same window in the force layout, the Bandage picture the graph is really
  // about: the backbone winds through the frame and every loop off it is an
  // alternate allele from the 464 haplotypes. FMMM again, hence diffThreshold.
  {
    mode: 'url',
    name: 'pangenome/hprc_mhc_bandage',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,500,000-32,560,000',
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'hprc_minigraph_bubbles',
            SEGMENTS_TRACK,
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: MHC_REGION,
          layoutMode: 'force',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    allowUnsettled: true,
    settleMs: 8000,
    diffThreshold: 0.1,
    viewportWidth: 1000,
    viewportHeight: 1300,
    hideTooltip: true,
  },

  // Where the launch actually lives. Both tutorials describe this click path in
  // prose ("Track menu, then Launch view, then Graph genome view (this
  // region)") and then show a figure of the result, so the one step a reader has
  // to find for themselves was the only step with no picture. Driven through the
  // real menu rather than baked, so the figure also exercises capability
  // discovery: the item is contributed by the plugin only for a track whose
  // adapter declares `getSubgraph`, and it lands inside core's shared "Launch
  // view" submenu beside any other plugin's offers.
  //
  // Rows go by testid, not text: the track's name is also its label in the view
  // behind the menu, and a text match resolves to the first visible match, which
  // is that label rather than the menu row.
  {
    mode: 'url',
    name: 'pangenome/rgfa_launch_menu',
    url: sessionSpec(CONFIG, {
      sessionTracks: [ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: ECOLI_WINDOW,
          tracks: [ECOLI_SEGMENTS_TRACK],
        },
      ],
    }),
    // a drawn segment label, so the tabix query has come back and the blocks the
    // menu is about are painted rather than a bare track
    readyText: SEGMENT_LABEL,
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    // the track plus the whole open menu. Sized to the menu, not to the track:
    // at 460 the last rows ran off the bottom edge, which reads as a clipped
    // screenshot rather than as a menu that continues
    viewportHeight: 580,
    hideTooltip: true,
    actions: [
      { type: 'click', selector: '[data-testid="track_menu_icon"]' },
      {
        type: 'click',
        selector: '[data-testid="cascading-submenu-launch_view"]',
      },
      {
        type: 'waitForSelector',
        selector:
          '[data-testid="cascading-menuitem-graph_genome_view_(this_region)"]',
      },
      { type: 'delay', ms: 500 },
    ],
  },

  // The per-feature entry point, which no figure covered and whose behavior the
  // prose only hinted at ("or right-click a segment for its neighbourhood"). A
  // right-click launches on the segment's own span padded by half its length on
  // either side, so the graph opens with context around the segment instead of
  // clipped to its ends — that padding is the thing worth seeing, and the only
  // way to see it is to take the path.
  //
  // Two frames because the menu is reachable only through the UI: the context
  // menu over the clicked segment, then the neighbourhood it cuts. The right
  // click targets the segment's rendered label rather than a viewport
  // coordinate — the label carries the feature id the display's delegated
  // handler resolves, so nothing here is measured off a previous capture.
  {
    mode: 'url',
    name: 'pangenome/rgfa_segment_neighbourhood',
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: SEGMENT_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 110 },
            ECOLI_SEGMENTS_TRACK,
          ],
        },
      ],
    }),
    readyText: SEGMENT_LABEL,
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    // enough for the linear view plus the open context menu, which is also
    // enough for the graph canvas once the second frame closes that view. Sized
    // to the shorter of the two states rather than the taller: at 900 the first
    // frame was a third empty page background and the graph still clipped.
    viewportHeight: 700,
    hideTooltip: true,
    actions: [
      {
        type: 'rightclick',
        selector: `[data-testid="feature-name-${SEGMENT_LABEL}"]`,
      },
      { type: 'waitForText', text: 'Launch view' },
      { type: 'delay', ms: 500 },
    ],
    stages: [
      {
        actions: [
          {
            type: 'click',
            selector: '[data-testid="cascading-submenu-launch_view"]',
          },
          {
            type: 'waitForSelector',
            selector:
              '[data-testid="cascading-menuitem-graph_genome_view_(this_segment)"]',
          },
          { type: 'delay', ms: 500 },
        ],
      },
      // A launch through the menu opens on the view's own defaults, so the graph
      // arrives in one uniform color; the rank colors the sibling figures were
      // given declaratively are a Color-dropdown step here, and the tutorials
      // tell the reader to take it. Driving it keeps the two halves of this
      // figure comparable and makes the step itself part of what is documented.
      // The dropdown has no testid, so it goes by its current value, which
      // appears nowhere else on the page.
      {
        actions: [
          {
            type: 'click',
            selector:
              '[data-testid="cascading-menuitem-graph_genome_view_(this_segment)"]',
          },
          { type: 'waitForSelector', selector: TOOLBAR_READY },
          { type: 'click', text: 'Uniform' },
          { type: 'click', text: 'Stable rank (rGFA)' },
          { type: 'delay', ms: 2000 },
          // close the linear view it was launched from, so this frame is the
          // subgraph rather than mostly its source. The window it cut stays
          // stated in the graph view's own title.
          { type: 'click', selector: '[data-testid="close_view"]' },
          { type: 'delay', ms: 3000 },
        ],
      },
    ],
  },

  // The anchored counterpart to hprc_mhc_bandage: the same MHC subgraph with x
  // back on GRCh38, which is the trade the HPRC tutorial spends a paragraph on
  // and had no picture of. Read as a pair, the two figures are the whole
  // argument for having both layouts — this one lines up under the linear view
  // above it, the force one does not and shows the graph's shape instead.
  // layoutMode is left at its 'auto' default, which is this layout whenever the
  // graph declares a rank-0 backbone.
  {
    mode: 'url',
    name: 'pangenome/hprc_mhc_anchored',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,500,000-32,560,000',
          // pinned heights: the three tracks left to themselves take two thirds
          // of the frame, and the point of this figure is the axis the graph
          // below shares with them
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              height: 100,
            },
            {
              trackId: 'hprc_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              height: 110,
            },
            {
              trackId: SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 130,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: MHC_REGION,
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    settleMs: 4000,
    viewportWidth: 1000,
    // the compacted linear stack plus the graph canvas in full: at 1000 the rank
    // rows ran off the bottom edge, which reads as a broken layout
    viewportHeight: 1180,
    hideTooltip: true,
  },

  // The human pangenome at C4, the second locus this graph is worth opening at
  // (see C4_WINDOW) and the one where the picture is a copy-number story rather
  // than an allelic-diversity one.
  //
  // Declarative rather than menu-driven, and only because of what the deployed
  // plugin bundle predates. Writing this figure as a launch is what found the
  // bug: the menu passes the *assembly's* canonical refName, which for this hg38
  // (`hg38.prefix.fa.gz`, and every GRCh38 FASTA on jbrowse.org) is the bare `6`,
  // while the graph's stable names are `GRCh38#0#chr6`, and the plugin's
  // `GetSubgraph` RPC did no refName renaming, so the launch resolved nothing and
  // opened a view reading "0 nodes, 0 edges" with no error. Fixed in the plugin
  // by extending `RpcMethodTypeWithRenameRegion` (verified locally: the same
  // menu-driven launch draws 30 nodes / 36 edges, matching this figure), but the
  // hosted bundle still has to be redeployed. Switch this spec to the driven form
  // once it is. E. coli is unaffected either way, its assembly refName `chr`
  // matching the graph's `K12#1#chr`, which is why the driven figures above are on
  // E. coli.
  {
    mode: 'url',
    name: 'pangenome/hprc_c4_subgraph',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: C4_WINDOW,
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              height: 100,
            },
            {
              trackId: 'hprc_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              height: 90,
            },
            {
              trackId: SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 120,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: {
            refName: 'chr6',
            assemblyName: 'hg38',
            start: 31980000,
            end: 32050000,
          },
          // The Bandage picture, not the rank ladder: correspondence with the
          // linear view above is carried by the shared rank colors, which is what
          // a reader actually reads, rather than by a shared x axis.
          layoutMode: 'force',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    // FMMM drifts a few percent between runs, so only a real change rewrites the
    // committed PNG. Note the trade this makes on a sparse figure: a graph canvas
    // is mostly white with thin strokes, so switching this spec from the anchored
    // layout to this one moved only 2.7% of pixels and was *kept* rather than
    // written. A real change to a force-layout figure needs `--force`; the
    // threshold cannot tell 3% of jitter from 3% of different-layout.
    diffThreshold: 0.1,
    viewportWidth: 1000,
    viewportHeight: 1290,
    hideTooltip: true,
  },
]
