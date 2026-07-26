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
// The only fixture loading the graph's contributing strains as assemblies,
// which is what the outbound launch needs: a node can open the strain it came
// from, and the window can open as a synteny view of the strains in it.
const ECOLI_PANGENOME_CONFIG = 'test_data/graphgenomeview/ecoli_pangenome.json'
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

// The pggb subgraph's own nodes, projected onto K12 by walking its reference P
// line, and colored by the file's itemRgb — which
// scripts/gfa_nodes_to_bed.py wrote out of the graph view's own viridis Depth
// ramp over the same subgraph. So the strip needs no `color` slot: what paints it
// is the graph's coloring, recorded rather than reproduced. Only nodes the
// reference path visits are in the file; the alternate alleles have no K12
// coordinate, the same asymmetry rank>0 has in the rGFA figures.
//
// `columnNames` names column 5 `depth` rather than leaving it `score`, so a
// tooltip says what the number is, and names `itemRgb` explicitly (BED9 is
// otherwise generic `field8`).
const PGGB_NODES_TRACK = 'ecoli_pggb_subgraph_nodes'
const PGGB_NODES_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: PGGB_NODES_TRACK,
  name: 'pggb subgraph: nodes on K12, colored by depth',
  assemblyNames: ['K12'],
  adapter: {
    type: 'BedTabixAdapter',
    uri: `${DATA}/ecoli_pggb_subgraph_nodes.bed.gz`,
    columnNames: [
      'chrom',
      'start',
      'end',
      'name',
      'depth',
      'strand',
      'thickStart',
      'thickEnd',
      'itemRgb',
    ],
  },
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

const ECOLI_ALLELES_TRACK = 'ecoli_minigraph_alleles'

// Viewport coordinate of CFT073's allele at PATHS_WINDOW's bubble, in the sample
// rows layout. A bare coordinate because the graph is canvas — there is no DOM
// node to select — and stable because that layout is deterministic: it is
// computed from SN/SO/SR, not simulated like FMMM. The hover and the ring drawn
// over it both read this, and the spec asserts the highlight appeared, so a
// coordinate that goes stale fails the capture instead of drifting quietly.
// It does go stale on a plugin layout change: the graph pane used to center its
// drawing in a fixed box and now sizes itself to it, which lifted every row
// ~172px and left this pointing below the pane.
const HOVERED_ALLELE = { x: 295, y: 555 }

// HG00738.2's allele on the HPRC sample-rows graph, whose context menu
// pangenome/hprc_node_menu is about. Read off the live model rather than
// measured on a capture: the graph auto-fits as its layout and canvas
// dimensions settle, so a coordinate taken from a finished PNG can point
// somewhere the click-time layout had nothing (which is exactly what happened
// while writing this spec — hence the settle delay before the right-click).
const HPRC_ALLELE = { x: 429, y: 612 }

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

// The structural tier of the wave VCF, which is what makes it comparable to the
// graph: minigraph collapses everything under ~50 bp, so an unfiltered callset
// is thousands of SNP columns the graph never had. `alleleLength` rather than
// end-start because an insertion consumes no reference and a span filter would
// keep only deletions. Same filter the hprc2 matrix figures use.
const SV_FILTER = ['jexl:alleleLength(feature) >= 50']

export const graphSpecs: ScreenshotSpec[] = [
  // The pggb subgraph, over the linear view of the same locus, in the SAME colors
  // (reviewer: "it would be great if we could get coloring on the linear genome
  // view that matches up to the graphgenomeview viewer").
  //
  // A pggb GFA tags no segment with a position, but the reference path's own P
  // line does: `K12#1#chr:1004500-1004961`, so walking it assigns every node it
  // visits a K12 span. That is the node strip above — one box per node, in the
  // view's own viridis Depth ramp, sampled over the subgraph's own min/max the
  // way the view samples it (scripts/gfa_nodes_to_bed.py, which reads
  // DEPTH_GRADIENT off the plugin). The colors are baked into the file's itemRgb
  // rather than jexl'd here, so the strip cannot drift from the graph: green is
  // depth 4, yellow is depth 5, and the 1 bp teal/blue ticks are pggb's
  // per-allele SNP nodes, whose depth is the count of paths carrying that allele.
  //
  // Green turns yellow at chr:1,004,667, which is CFT073 rejoining: its path
  // covers only the last 293 bp of the window (verified against the FASTAs —
  // CFT073:1,048,591-1,048,883 is 96.9% identical to K12:1,004,669-1,004,961),
  // and that is exactly where ycbF ends and pyrD starts in the gene lane.
  //
  // No MAF lane, deliberately: pggb's own `-M` MAF has no CFT073 row anywhere in
  // this window (it places that copy of the sequence ~1.7 kb downstream, against
  // K12:1,006,313), so its coverage band reads a flat 4 where the graph reads 5.
  // Two disagreeing readouts of the same graph is the opposite of the
  // correspondence this figure is for; pangenome/maf is the MAF's own figure.
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
      // assembly, so both lanes come in as session tracks
      sessionTracks: [K12_GENES_SESSION_TRACK, PGGB_NODES_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1,004,450-1,005,010',
          tracks: [
            {
              trackId: PGGB_NODES_TRACK,
              type: 'LinearBasicDisplay',
              // one row of color: the strip is 36 nodes over 561 bp, and their
              // ids are bare integers that carry nothing at this width
              displayMode: 'collapsed',
              height: 40,
            },
            {
              trackId: 'K12_genes',
              type: 'LinearBasicDisplay',
              height: 60,
              // grey, so the only colors in the frame are the graph's: at the
              // default goldenrod the gene boxes read as more depth-5 nodes
              color: 'rgb(130,130,130)',
            },
          ],
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
    // the graph view draws into the pinned canvasHeight above, so the frame has
    // to be the linear view plus that plus both headers or the layout is clipped
    viewportHeight: 1010,
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
    // GraphGenomeView takes no `height` through the launch snapshot. It used to
    // center a wide-and-flat anchored layout in a fixed box, so the frame had to
    // be 900 to reach it; the pane sizes itself to its drawing now, and the
    // extra 285px is page background.
    viewportHeight: 615,
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
  // The same window derived from the graph ALONE — no assemblies re-mapped, so
  // no haplotype rows. Same locus as the paths figure above on purpose: the two
  // are the with-assemblies and without-assemblies readings of one graph, and
  // the insertion sizes agree.
  //
  // An AlignmentsTrack over a BED is the point, not a mistake. Each allele
  // carries a CIGAR against the reference span it replaces (`2062M63348I`), and
  // the alignments display draws whatever has a CIGAR — so the alleles pack into
  // rows and each insertion draws at its real magnitude. As a plain feature
  // track the 63 kb allele would be a 1 bp box, which is the defect this whole
  // projection exists to avoid.
  {
    mode: 'url',
    name: 'pangenome/rgfa_allele_inventory',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        ECOLI_SEGMENTS_SESSION_TRACK,
        {
          type: 'AlignmentsTrack',
          trackId: ECOLI_ALLELES_TRACK,
          name: 'minigraph graph: allele inventory (from the rGFA alone)',
          assemblyNames: ['K12'],
          adapter: {
            type: 'BedTabixAdapter',
            uri: `${DATA}/ecoli_minigraph.alleles.bed.gz`,
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PATHS_WINDOW,
          tracks: [
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 100,
            },
            {
              trackId: ECOLI_ALLELES_TRACK,
              type: 'LinearAlignmentsDisplay',
              // tall enough that the packed rows keep the bp labels on their
              // insertion markers, which is what carries the magnitude
              height: 150,
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    // the two tracks plus both headers, no more: the alleles pack into four
    // rows here, so anything taller is whitespace
    viewportHeight: 430,
    hideTooltip: true,
  },
  // The same window in the force layout, the Bandage picture the graph is really
  // about: the backbone winds through the frame and every loop off it is an
  // alternate allele from the 464 haplotypes. FMMM again, hence diffThreshold.
  //
  // The four linear lanes are the answer to "can only see blue in the hprc
  // track — if the orange are nonreference and cant be shown as segments in the
  // linear genome, what should we do?". Blue and orange both appear, in the
  // graph's own Stable rank colors, but on different objects, because only rank 0
  // has an hg38 coordinate at all:
  //
  //   blue segments = the rank-0 backbone, the same blue the graph draws
  //   orange bubble = where the orange loops attach (rank-1 orange, set on the
  //                   track in hprc.json so every figure using it matches)
  //   alleles       = the non-reference sequence itself, drawn the only way a
  //                   reference axis can hold it: an insertion marker at its
  //                   anchor, widened to the allele's own bp by the CIGAR in the
  //                   BED. Its span cannot be drawn — a rank>0 segment lives on
  //                   another assembly's refName — so its length is.
  //
  // Heights pinned: left to themselves the lanes take half the frame, and the
  // segments track spends it on rows of `s101124` labels that carry nothing here.
  // What it is here for is the blue backbone, which one row of blocks shows as
  // well as four.
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
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              height: 70,
            },
            {
              trackId: 'hprc_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              height: 90,
            },
            {
              trackId: SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 70,
            },
            {
              trackId: 'hprc_minigraph_alleles',
              type: 'LinearAlignmentsDisplay',
              // tall enough to keep the bp label on each insertion marker, which
              // is the whole point of the lane, and no taller: the alleles pack
              // into three rows over this window
              height: 110,
            },
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
    // TOOLBAR_READY ANDed with the allele lane's own fetch, so the capture can't
    // land with the graph laid out and the fourth lane still blank. Spelled out
    // rather than composed with TOOLBAR_READY: that already opens on `body:has`,
    // and prefixing a second one asks for a body inside a body.
    readySelector:
      'body:has([data-testid="pileup-display-done"]):has([data-testid="graph-perf-stats"]) [data-testid="graph-layout-select"]',
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    diffThreshold: 0.1,
    viewportWidth: 1000,
    viewportHeight: 1370,
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
    // enough for the linear view plus the open context menu, which is the taller
    // of the two states; the launched graph gets its own height on its stage
    viewportHeight: 630,
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
        // the graph pane sizes itself to its drawing, and a 13-node subgraph is
        // a short one; at the frame above it this half was more than half page
        // background
        viewportHeight: 345,
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

  // The HPRC counterpart to rgfa_allele_inventory. The E. coli figure proves the
  // AlignmentsTrack-over-a-BED idea on 845 alleles; this one is the reason it
  // matters, at 208k. MHC class II, the densest window in the tutorial's locus
  // table (56 alleles, longest 94 kb), with the segments track above so the same
  // rank colors tie the two: the blue backbone up top is what these alleles are
  // stated against.
  //
  // No GraphGenomeView here, so the readiness gate is the pileup's, not
  // TOOLBAR_READY. The graph plugin is still loaded by hprc.json, which is
  // harmless and keeps the figure openable in the same config as its neighbours.
  {
    mode: 'url',
    name: 'pangenome/hprc_allele_inventory',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,510,000-32,600,000',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 60,
            },
            {
              trackId: SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 100,
            },
            {
              // tall enough that the packed alleles keep the bp label on their
              // insertion markers, which is what carries the magnitude, and no
              // taller: they pack into three rows here
              trackId: 'hprc_minigraph_alleles',
              type: 'LinearAlignmentsDisplay',
              height: 150,
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 120000,
    settleMs: 4000,
    viewportWidth: 1000,
    viewportHeight: 545,
    hideTooltip: true,
  },

  // The two products at one locus, which is the argument the HPRC tutorial
  // closes on ("the matrix for base-level variation across haplotypes, the graph
  // for how the sequence rearranges") and had no picture of. The graph route
  // above says an allele exists and how long it is but not whose it is;
  // minigraph collapses, so it cannot. The callset below is the same window's
  // structural tier, one row per haplotype, and answers exactly the question the
  // inventory cannot.
  //
  // Both panes are filtered to the structural tier so they are comparable: the
  // graph holds only SVs by construction, and `alleleLength(feature) >= 50`
  // takes the VCF to the same tier (a span filter would keep deletions only,
  // since an insertion consumes no reference).
  //
  // The regular multi-sample display, not the matrix: these columns have to land
  // under the allele that produced them, and matrix mode spreads columns evenly
  // across the width, which would break exactly the correspondence this figure
  // is for. Clustered so carriers of a shared allele form a block rather than
  // scattering, via the declarative `runClustering` trigger.
  {
    mode: 'url',
    name: 'pangenome/hprc_graph_vs_callset',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,510,000-32,600,000',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 60,
            },
            {
              trackId: 'hprc_minigraph_alleles',
              type: 'LinearAlignmentsDisplay',
              height: 110,
            },
            {
              trackId: 'hprc2_wave_grch38',
              type: 'LinearMultiSampleVariantDisplay',
              height: 420,
              jexlFilters: SV_FILTER,
              runClustering: true,
            },
          ],
        },
      ],
    }),
    // three signals, ANDed: the alleles painted, the callset's own fetch
    // finished (not just first paint), and the post-clustering frame. A bare
    // comma list would be a CSS OR and fire on whichever landed first.
    readySelector:
      'body:has([data-testid="pileup-display-done"]):has([data-testid="tree_sidebar_dendrogram"]) [data-testid="variant-display-done"][data-display-phase="ready"]',
    readyTimeout: 360000,
    settleMs: 5000,
    viewportWidth: 1000,
    viewportHeight: 865,
    hideTooltip: true,
  },
  // The linearization: x is reference bp and each row is one contributing
  // assembly, so reading across a row says what that strain does to K12. The
  // per-rank anchored layout cannot say this — at an HPRC locus one rank holds
  // alleles from dozens of haplotypes, so a rank row means nothing biological.
  //
  // Row labels come from the layout itself (LayoutResult.rowLabels), built from
  // the same row map that positioned the nodes, so a label cannot name a row the
  // drawing put elsewhere.
  {
    mode: 'url',
    name: 'pangenome/rgfa_sample_rows',
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PATHS_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 80,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: {
            refName: 'chr',
            assemblyName: 'K12',
            start: 1088000,
            end: 1104000,
          },
          layoutMode: 'samplerows',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    settleMs: 4000,
    viewportWidth: 1000,
    // the graph pane sizes itself to its drawing, so this is the two views and
    // nothing under them
    viewportHeight: 745,
    hideTooltip: true,
  },
  // The correspondence, which is the reason to open the two views together:
  // hovering a node in the graph highlights the reference interval it occupies
  // in every linear view connected to it, and hovering the linear view
  // highlights the node. Both directions run through the plugin's hoverSync;
  // this captures the graph-to-linear one, because its result is a band drawn
  // from real coordinates (`getHighlightCoords`) rather than a color change on
  // one node.
  //
  // The hover target is a bare viewport coordinate because the graph is canvas:
  // there is no DOM node to select. It is stable here in a way it would not be
  // on the FMMM layout — sample rows is deterministic, computed from SN/SO/SR,
  // so the allele sits at the same place every run. `readySelector` waits on the
  // band itself, so a miss fails the spec instead of silently capturing a figure
  // with nothing highlighted.
  {
    mode: 'url',
    name: 'pangenome/rgfa_hover_correspondence',
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PATHS_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 80,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: {
            refName: 'chr',
            assemblyName: 'K12',
            start: 1088000,
            end: 1104000,
          },
          layoutMode: 'samplerows',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    // Readiness is the layout having drawn; the highlight cannot exist yet,
    // because it is the hover below that creates it. Asserting it as an action
    // instead is what makes a missed hover fail the spec rather than quietly
    // committing a figure with nothing highlighted.
    readySelector: '[data-testid="graph-row-label"]',
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the graph pane sizes itself to its drawing, so this is the two views and
    // nothing under them
    viewportHeight: 745,
    actions: [
      { type: 'delay', ms: 3000 },
      { type: 'hover', from: HOVERED_ALLELE },
      {
        type: 'waitForSelector',
        selector: '[data-testid="graph-node-highlight"]',
      },
      { type: 'delay', ms: 1000 },
    ],
    // A hover figure has no cursor in it, so without this the reader sees a band
    // appear and cannot tell what produced it. Drawn at the same coordinate the
    // hover uses, so the ring and the pointer cannot end up in different places
    // — the one case where a raw x/y annotation is not a hand-measurement, it is
    // the input being echoed.
    annotations: [
      { type: 'circle', x: HOVERED_ALLELE.x, y: HOVERED_ALLELE.y, radius: 18 },
    ],
  },
  // The other direction, which the figure above does not show and the prose only
  // claimed: hovering the LINEAR view highlights the graph. It is the half a
  // reader is more likely to use — you arrive at a locus through genes, not
  // through node ids — and it runs through different code: an LGV publishes
  // `{hoverPosition, hoverFeature}` to session.hovered, and the graph's own
  // autorun matches it (hoverSync/lgvHover).
  //
  // The target is a gene rather than the graph's own segments track on purpose.
  // A segment feature matches by name, which is the easy path; a gene supplies
  // only a coordinate, so this exercises the fallback that finds the backbone
  // segment covering it — the case that makes the correspondence useful from any
  // track rather than only from the graph's own.
  //
  // Asserted on the same testid as the figure above, which is what makes this a
  // round trip rather than a screenshot of a tooltip: the band can only appear
  // if the graph matched a node AND resolved its reference span back.
  {
    mode: 'url',
    name: 'pangenome/rgfa_hover_from_linear',
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PATHS_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 80,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: {
            refName: 'chr',
            assemblyName: 'K12',
            start: 1088000,
            end: 1104000,
          },
          layoutMode: 'samplerows',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: '[data-testid="graph-row-label"]',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 745,
    actions: [
      { type: 'delay', ms: 3000 },
      // by the gene's own rendered label, so nothing here is a viewport
      // coordinate measured off a previous capture
      { type: 'hover', selector: '[data-testid="feature-name-csgG"]' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="graph-node-highlight"]',
      },
      { type: 'delay', ms: 1000 },
    ],
  },

  // The other half of the way out, on the graph where the contributing
  // assemblies are NOT loadable: right-clicking one haplotype's allele. Its own
  // coordinate is exact and unopenable (no session loads 464 haplotypes as
  // assemblies), so what the menu offers is the GRCh38 interval the allele
  // attaches to, which is the answer the HPRC tutorial's round trip needs.
  //
  // The right-click is a bare viewport coordinate for the same reason
  // HOVERED_ALLELE is: the graph is canvas, and this layout is deterministic. A
  // coordinate that goes stale opens no menu, and the waitForText below then
  // fails the capture rather than committing a figure of an unopened menu.
  {
    mode: 'url',
    name: 'pangenome/hprc_node_menu',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,500,000-32,560,000',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              height: 80,
            },
            {
              trackId: SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 80,
            },
          ],
        },
        {
          id: 'hprc_node_graph',
          type: 'GraphGenomeView',
          displayName: 'Graph — hg38 chr6:32,500,000-32,560,000',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: MHC_REGION,
          layoutMode: 'samplerows',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: '[data-testid="graph-row-label"]',
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    viewportHeight: 900,
    actions: [
      // the auto-fit has to have finished before a coordinate means anything
      { type: 'delay', ms: 2000 },
      { type: 'rightclick', from: HPRC_ALLELE },
      { type: 'waitForText', text: 'Node details' },
      { type: 'delay', ms: 500 },
    ],
  },

  // The way back out of the graph, on the one fixture where it can do more than
  // return to the reference: all five strains loaded as assemblies, so the graph
  // offers a linear view of each contributing strain at its own coordinates, and
  // a synteny view of all of them at once.
  //
  // Driven through the view menu by text rather than by canvas coordinates, so
  // nothing here is measured off a previous capture.
  {
    mode: 'url',
    name: 'pangenome/rgfa_launch_out_menu',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: ECOLI_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 70,
            },
          ],
        },
        {
          id: 'launch_out_graph',
          type: 'GraphGenomeView',
          displayName: 'Graph — K12 chr:4,050,000-4,100,000',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: {
            refName: 'chr',
            assemblyName: 'K12',
            start: 4050000,
            end: 4100000,
          },
          layoutMode: 'samplerows',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: '[data-testid="graph-row-label"]',
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    viewportHeight: 700,
    hideTooltip: true,
    actions: [
      // the graph view's own menu, scoped through its pinned view id, since
      // both views on the page carry a view_menu_icon
      {
        type: 'click',
        selector:
          '[data-testid="view-container-launch_out_graph"] [data-testid="view_menu_icon"]',
      },
      { type: 'click', text: 'Launch view' },
      // expand the per-strain list rather than leaving it a closed submenu row,
      // which is the half of the menu the figure is about
      { type: 'hover', text: 'Linear genome view' },
      { type: 'waitForText', text: 'CFT073 chr:' },
      { type: 'delay', ms: 500 },
    ],
  },
]
