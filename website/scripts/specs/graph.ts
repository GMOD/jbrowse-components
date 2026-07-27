import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the pangenome tutorials that use the third-party
// jbrowse-plugin-graphgenomeview (GraphGenomeView). The plugin bundle and the
// GFA fixtures are served same-origin from test_data/graphgenomeview, so the
// cross-origin plugin-trust dialog never triggers in the headless capture. The
// GFA slice is the same four-strain E. coli minigraph data the pangenome_ecoli
// tutorial builds its rGFA graph figures from.
//
// The anchored (rGFA) layout is computed locally from the SR:i:0 rank tags. The
// force-directed (Bandage FMMM) layout renders through the same pipeline — the
// worker resolves its WASM engine from the plugin's own bundle url. Both are
// deterministic, so no graph spec needs a raised diffThreshold: FMMM seeded its
// initial placement from clock() until the plugin fixed the seed, and the ~2%
// of pixels that moved on every regen was enough to hide a real change (an
// orange recolour shipped as goldenrod in three figures under that threshold).
//
// Every fixture pins `esmUrl` to a content-addressed bundle
// (test_data/graphgenomeview/README.md), so the plugin cannot change these
// figures without a diff in this repo.

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

// Paint the linear segments track in the graph view's own 'Stable rank'
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

// The pggb graph itself, browsable by locus — the whole 606k-segment base-level
// graph rather than a window someone cut out of it beforehand.
//
// This is the same `RgfaTabixAdapter` the minigraph tracks use, on the same two
// BEDs, and that is the point: a plain GFA carries no SN/SO/SR tags, but
// walking its P lines assigns every segment it visits an interval, which is the
// same information in a different encoding. scripts/build_pggb_tabix.sh does
// that walk offline and emits the exact files the adapter already reads
// (verified against the independent `odgi extract` route: at the local_subgraph
// window every interval matches). So region query, the subgraph cut, both
// anchored layouts, the launch menus and hover sync all work here with nothing
// added to the app.
//
// A base-level graph runs ~17 bp per segment, so the window that fits is small:
// this 3 kb one cuts ~340 segments, where the same 3 kb of the SV-resolution
// minigraph graph is a handful.
const PGGB_SEGMENTS_TRACK = 'ecoli_pggb_segments'
const PGGB_SEGMENTS_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: PGGB_SEGMENTS_TRACK,
  name: 'pggb graph segments (whole graph, by locus)',
  assemblyNames: ['K12'],
  adapter: {
    type: 'RgfaTabixAdapter',
    uri: `${DATA}/ecoli_pggb`,
  },
}

// The colanic-acid cluster, where the graph is busiest in this stretch: `tabix ecoli_pggb.links.bed.gz
// 'K12#1#chr:2120000-2123000'` returns 175 link endpoints on a non-K12 stable
// sequence, against 24 at the ycbF/pyrD window the local_subgraph figure uses.
const PGGB_LOCUS = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 2121000,
  end: 2122000,
}
const PGGB_LOCUS_WINDOW = 'chr:2,121,000-2,122,000'

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

// The bubble the hover and sample-rows figures are about: K12
// chr:1,094,197-1,097,573, where Sakai and CFT073 carry ~110-113 kb alleles,
// NCTC86 a 41 kb one, and IAI39 deletes 3.2 kb. Picked off the BED, not by eye:
// `tabix ecoli_minigraph_paths.bed.gz chr:1094000-1098000`. The window is ~5x
// the bubble so the flanking reference-path blocks show it is a local event.
const PATHS_WINDOW = 'chr:1,088,000-1,104,000'
const PATHS_WINDOW_WIDE = 'chr:1,000,000-1,200,000'

// The per-strain track's own window, and 12x wider than the one above on
// purpose. Review of the old figure: "this looks very odd. it is a large
// insertion, but it should just look like a normal linearmafdisplay kind of
// instead of this weird custom thing." At 16 kb the frame held ONE bubble, so
// five stacked full-width boxes with numbers printed in them read as a bar
// chart of one event rather than as five haplotypes. 200 kb holds 20 bubbles
// (`tabix ecoli_minigraph_paths.bed.gz chr:1000000-1200000 | wc -l` is 100 rows
// over 5 strains), which is what makes a row read as a lane: mostly grey
// reference path, punctuated where that strain diverges.

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

// One of HG01433.2's alleles, mid-window so its highlight lands inside the
// linear view's frame rather than on its edge on the HPRC sample-rows graph, whose context menu
// pangenome/hprc_node_menu is about. Measured on the spec's own capture rather
// than on a model probe at a different viewport, which is the trap here: the graph auto-fits as its layout and canvas
// dimensions settle, so a coordinate taken from a finished PNG can point
// somewhere the click-time layout had nothing (which is exactly what happened
// while writing this spec — hence the settle delay before the right-click).
// It restales on any layout change above the graph: the segments lane losing
// its label rows lifted every row by about that much.
const HPRC_ALLELE = { x: 305, y: 622 }

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
// The launch-out figure's graph view, pinned so its menu and its callout still
// resolve to it once the launch has added a second view to the page.
const LAUNCH_OUT_VIEW = '[data-testid="view-container-launch_out_graph"]'

// A 50 kb K12 window chosen for what the launch produces, not for the graph:
// the synteny view it opens gets one panel per contributing strain, at the span
// that strain's own segments cover, so a window where a strain contributes a
// single small segment opens a panel a few bp wide. ECOLI_WINDOW is one — IAI39
// reaches it through 8 bp — and the launched view was four panels at four
// unrelated scales. Scoring every 50 kb window on the smallest span any strain
// contributes (over the segs/links BEDs the track reads) puts this one near the
// top: all five between 38 kb and 69 kb, so the panels open comparable.
const LAUNCH_OUT_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 4400000,
  end: 4450000,
}

// K12's asnW/asnU/asnV cluster: three of the four asn tRNA genes, which are the
// sites E. coli pathogenicity islands integrate at. Chosen by scanning the
// segments/links BEDs for a window where one strain contributes a lot and the
// others contribute nothing — here CFT073 brings 58,692 bp in two segments while
// IAI39 and NCTC86 reach it through 1 bp each, so the single long row is
// unambiguous.
//
// 8 kb, because the width of this window sets the width of what the launch
// opens: the launched locus is the widest run of CFT073 segments the subgraph
// holds, and a wider seed pulls in the yersiniabactin island next door and opens
// 130 kb, where no gene is wide enough to carry a label.
const PKS_WINDOW = 'chr:2,056,000-2,064,000'
const PKS_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 2056000,
  end: 2064000,
}
const PKS_VIEW = '[data-testid="view-container-pks_graph"]'

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

// Sample rows has a row-count ceiling, and it is not the data's. Row spacing is
// 5% of the drawn width (ROW_SPACING_SPAN_FRACTION) and the graph pane caps at
// 600 px, so a drawing taller than it is wide gets fitted to the pane's HEIGHT
// and centered — the backbone then spans a fraction of the pane and no longer
// sits under the linear view's x axis, which is the one thing this layout is
// for. The crossover is around a dozen rows at these widths.
//
// So this figure takes the 90 kb MHC class II window (MHC_CLASSII_REGION,
// below) rather than the 600 kb one that would draw 28 donor rows: measured on
// both, the wide one is denser and reads worse, because the fit shrinks it off
// the axis. Density in this view is bounded either way — see C4_WINDOW below
// for the force layout's version of the same ceiling.

// C4, for the launch figure, from the tutorial's own table of loci worth a look.
// `tabix hprc-v2.0-mc-grch38.links.bed.gz 'GRCh38#0#chr6:31980000-32050000'`
// gives 13 rank-0 backbone segments and 21 links out to non-reference segments
// with ranks up to 165, which is C4A/C4B copy number and the HERV insertion as
// the graph records them.
//
// 70 kb is a readability choice, not a cap: the region cap is 5 Mb and the node
// budget 20,000, and this cuts 30 nodes. A wider window makes a force figure
// worse, measured rather than guessed — the plugin's Bandage WASM run offline
// over the real subgraphs (agent-docs/reference/PANGENOME_GRAPHS.md records
// them) gives, fitted to this pane:
//
//   60 kb    108 nodes   mean node 62-77 px   ~2% of the canvas inked
//   1 Mb     449 nodes   mean node 15 px      ~2%
//   3.5 Mb  1041 nodes   mean node  5 px      ~2%
//
// The inked fraction is flat because bandageAutoScale targets a mean drawn node
// length of 40 FMMM units whatever the node count, so FMMM lays a near-path
// pangenome graph out as one thread whose length grows with N and whose 2-D
// coverage does not; zoom-to-fit then shrinks every bubble by the same factor.
// More nodes buys no density, only smaller features — at 3.5 Mb the loops that
// carry the figure are 5 px specks. Density comes from the row layouts instead,
// whose height grows with the data.
const C4_WINDOW = 'chr6:31,980,000-32,050,000'
const C4_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 31980000,
  end: 32050000,
}

// Wide enough to the left that LPA's own start (160,531,482) is in frame, so the
// gene track labels it: a window sitting entirely inside one gene draws that
// gene's label off the left edge, and the figure then names nothing.
const LPA_WINDOW = 'chr6:160,525,000-160,655,000'
const LPA_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 160525000,
  end: 160655000,
}

// MHC class II, the densest window in the tutorial's locus table, and the one
// where the graph and the callset are worth putting in one frame.
const MHC_CLASSII_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 32510000,
  end: 32600000,
}

// The 10 donors with a non-reference path through the minigraph subgraph over
// MHC_CLASSII_REGION (`tabix hprc-v2.0-mc-grch38.links.bed.gz
// 'GRCh38#0#chr6:32510000-32600000'`, every non-GRCh38 column), in the same
// alphabetical order GraphGenomeView's sample-rows layout sorts by. Passed as
// the callset display's `layout` (not `runClustering`) so the row SET matches
// the graph's: both haplotypes of each donor, so a carrier row sits next to
// its non-carrier sibling rather than the sibling being silently absent.
const MHC_CALLSET_LAYOUT = [
  'HG00642',
  'HG00738',
  'HG01433',
  'HG01978',
  'HG01993',
  'HG04157',
  'HG04160',
  'NA18940',
  'NA18959',
  'NA20809',
].map(name => ({ name }))

// The linear half of the graph view's 'Reference position' color scheme, which
// is the answer to "if the nodes were rainbow colored in exact same way in
// lineargenomeview and bandage graph it might help show correspondance".
//
// That scheme is a hue ramp over the region the subgraph was cut from: hue 0
// (red) at its start to 300 (magenta) at its end, at saturation 70% and
// lightness 50%, and a node with no reference coordinate of its own takes the
// hue of the backbone interval it branches from
// (jbrowse-plugin-graphgenomeview renderer/GeometryBuilder.ts,
// REFERENCE_RAMP_MAX_HUE). It is a function of two stated numbers and a
// midpoint, which is the whole reason it exists: a linear track can reproduce
// it exactly, so a block above and a node below are the same color for the same
// bp. Every scheme before it could not — depth and rank are graph quantities,
// and the old rainbow ramped over node index, which a linear view cannot know.
//
// Rank rides on lightness, not on hue: an off-reference segment keeps the hue of
// the reference it replaces and is painted paler (45%/72% against 70%/50%), so
// the correspondence survives while a rank row stops being the same swatch as
// the backbone. On a lane over the REFERENCE that branch never fires — a rank>0
// segment states its coordinates on its own stable sequence, so it is not in the
// window at all — and the pair of rows a dense lane draws is the layout packing
// rank-0 blocks, not rank. It is here for a lane opened on a contributing
// assembly, where those segments do appear, and so the ramp cannot disagree with
// the graph beside it. `rank` is what RgfaTabixAdapter puts on the feature; a
// track carrying none reads `undefined > 0` as false and stays on the reference
// pair.
//
// The domain has to be the graph's loadedRegion, not the linear view's window,
// when the two differ.
function referencePositionColor({
  start,
  end,
}: {
  start: number
  end: number
}) {
  const mid = "(get(feature,'start')+get(feature,'end'))/2"
  const hue = `min(300, max(0, (${mid} - ${start}) / ${end - start} * 300))`
  const rank = "get(feature,'rank')>0 ? '45%,72%' : '70%,50%'"
  return `jexl:'hsl(' + ${hue} + ',' + (${rank}) + ')'`
}

// The HPRC segments lane, shared by every figure that carries it so they read
// the same. Labels off: the ids are the graph's own `s101124` counters, which
// name nothing a reader can look up, and at these widths the display spends
// three or four rows of text on them — in the 90 kb allele-inventory frame they
// covered more area than the blocks did. What the lane is for is the blue rank-0
// backbone tiling the reference, which one row of blocks says as well as four,
// so the height is that one row.
//
// Colored by the graph's own reference-position ramp over the window the
// subgraph beside it was cut from, so the lane is the graph's backbone twice:
// once as blocks on the reference, once as a thread in the graph, in the same
// colors left to right.
function hprcSegmentsLane(domain: { start: number; end: number }) {
  return {
    trackId: SEGMENTS_TRACK,
    type: 'LinearBasicDisplay',
    showLabels: 'off',
    height: 45,
    color: referencePositionColor(domain),
  }
}

// The structural tier of the wave VCF, which is what makes it comparable to the
// graph: minigraph collapses everything under ~50 bp, so an unfiltered callset
// is thousands of SNP columns the graph never had. `alleleLength` rather than
// end-start because an insertion consumes no reference and a span filter would
// keep only deletions. Same filter the hprc2 matrix figures use.
const SV_FILTER = ['jexl:alleleLength(feature) >= 50']

// The session three figures share: the genes and the graph's own segments over
// the bubble window, with the subgraph launched from that same track in sample
// rows. Written once because two of the three assert against coordinates
// measured in this exact layout — a stray difference between the copies would
// move the hover target without failing anything.
function ecoliSampleRowsSession() {
  return sessionSpec(CONFIG, {
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
  })
}

// The pggb pair: same locus, same colors, one in each anchored layout.
function pggbLocusSession(layoutMode?: 'samplerows') {
  return sessionSpec(CONFIG, {
    sessionTracks: [K12_GENES_SESSION_TRACK, PGGB_SEGMENTS_SESSION_TRACK],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: PGGB_LOCUS_WINDOW,
        tracks: [
          { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
          {
            trackId: PGGB_SEGMENTS_TRACK,
            type: 'LinearBasicDisplay',
            // labels off: at this density they are hundreds of overlapping
            // integer ids, and the lane is here for the color sweep
            showLabels: 'off',
            height: 50,
            color: referencePositionColor(PGGB_LOCUS),
          },
        ],
      },
      {
        type: 'GraphGenomeView',
        loadedTrackId: PGGB_SEGMENTS_TRACK,
        loadedRegion: PGGB_LOCUS,
        ...(layoutMode ? { layoutMode } : {}),
        colorScheme: 'reference-position',
      },
    ],
  })
}

export const graphSpecs: ScreenshotSpec[] = [
  // A pggb graph opened at a locus, with no window cut beforehand. Until this
  // existed the pggb tutorial had to send the reader to `odgi extract` for
  // every look, which is why its one graph figure (local_subgraph) is a
  // hand-extracted 561 bp file: base-level graphs state their coordinates in
  // path order, and nothing indexed that. Now the same walk runs offline once
  // (scripts/build_pggb_tabix.sh) and the whole graph is queryable.
  //
  // Both panels in the reference-position ramp, which does more here than on a
  // minigraph graph: at ~17 bp per segment the backbone is hundreds of tiny
  // blocks rather than a few long ones, and a solid left-to-right hue sweep is
  // what says they are consecutive rather than scattered.
  {
    mode: 'url',
    name: 'pangenome/pggb_locus_graph',
    url: pggbLocusSession(),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    settleMs: 5000,
    viewportWidth: 1000,
    // the two lanes plus the graph pane, which sizes itself to two rows here
    viewportHeight: 634,
    hideTooltip: true,
  },
  // The same locus per strain, which is where a path GFA says something an rGFA
  // cannot. Sample rows put each segment on the row of the assembly its stable
  // name gives it; on an rGFA that name is whichever assembly minigraph
  // *contributed* it first (SR is build order), so both tutorials have to warn
  // that a row is first-seen attribution. Here the name comes from a path that
  // actually walks the segment, so a row is carriage.
  //
  // Same window and same colors as the figure above, so the pair reads as one
  // graph seen two ways rather than as two loci.
  {
    mode: 'url',
    name: 'pangenome/pggb_locus_sample_rows',
    url: pggbLocusSession('samplerows'),
    readySelector:
      'body:has([data-testid="graph-row-label"]) [data-testid="graph-layout-select"]',
    readyTimeout: 120000,
    settleMs: 5000,
    viewportWidth: 1000,
    // the two lanes plus the graph's five rows, and nothing under them
    viewportHeight: 733,
    hideTooltip: true,
  },
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
  // The graph draws on that same K12 axis rather than force-directed, because
  // the plugin now does the walk above for itself: `referencePath` names the
  // path, every node it visits becomes rank 0 at the offset the walk reaches it
  // at, and the rest become rank 1 (jbrowse-plugin-graphgenomeview
  // src/GraphGenomeView/pathAnchoring.ts). So the two panels share an axis, not
  // just a color ramp — the strip's green-to-yellow step is the same step in
  // the graph's backbone, at the same x. It is also deterministic, so this no
  // longer needs the raised diffThreshold FMMM jitter forced.
  //
  // `referencePath` has to be stated: a general GFA's path names are arbitrary
  // and nothing in the file marks one as the reference, and a whole-file import
  // has no region to infer it from either. 'K12' matches on the PanSN sample
  // name of `K12#1#chr:1004500-1004961`.
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
          layoutMode: 'auto',
          referencePath: 'K12',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    // The anchored layout has a pinned aspect ratio — row spacing is a fraction
    // of the reference span — so the graph pane sizes itself to two rows rather
    // than to the 600px box FMMM filled. The frame is the linear view plus that.
    viewportHeight: 640,
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
  // The graph read as an alignment: five haplotype rows over 200 kb of K12, one
  // block per bubble per strain. The segments track above is the same graph
  // per-segment, so the two lanes are the two ways of reading one file.
  //
  // Window is PATHS_WINDOW_WIDE, for the reason stated there: a row has to hold
  // enough bubbles to read as a haplotype's path rather than as one bar.
  {
    mode: 'url',
    name: 'pangenome/rgfa_strain_paths',
    url: sessionSpec(CONFIG, {
      sessionTracks: [ECOLI_SEGMENTS_SESSION_TRACK, ECOLI_PATHS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PATHS_WINDOW_WIDE,
          tracks: [
            // No gene lane: at 200 kb it is ~190 unlabelled boxes, a gold band
            // that says nothing this figure is about
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              showLabels: 'off',
              height: 60,
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
    // the two pinned tracks plus both headers, and nothing under them
    viewportHeight: 465,
    hideTooltip: true,
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
          { type: 'click', text: 'Stable rank' },
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

  // The anchored counterpart to the force layout: an MHC subgraph with x back on
  // GRCh38, which is the trade the HPRC tutorial spends a paragraph on and had
  // no picture of. Read against hprc_c4_subgraph, the two are the whole argument
  // for having both layouts — this one lines up under the linear view above it,
  // the force one does not and shows the graph's shape instead.
  // layoutMode is left at its 'auto' default, which is this layout whenever the
  // graph declares a rank-0 backbone.
  //
  // Reference-position colors here too, for a reason this figure has and its
  // force sibling does not: sharing an axis is not the same as being seen to
  // share one. Review: "just hard to figure out correspondance between linear
  // and graph". A reader can now check the claim without measuring — the
  // segment under the x they are looking at and the node below it are the same
  // color, and the ramp runs the same way in both panels.
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
            hprcSegmentsLane(MHC_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: MHC_REGION,
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    settleMs: 4000,
    viewportWidth: 1000,
    // the compacted linear stack plus the graph canvas in full: at 1000 the rank
    // rows ran off the bottom edge, which reads as a broken layout
    viewportHeight: 995,
    hideTooltip: true,
  },

  // The human pangenome at C4, the second locus this graph is worth opening at
  // (see C4_WINDOW) and the one where the picture is a copy-number story rather
  // than an allelic-diversity one.
  //
  // Declarative rather than menu-driven, which is now a free choice rather than
  // a forced one. Writing this figure as a launch is what found the bug: the
  // menu passes the *assembly's* canonical refName, which for this hg38
  // (`hg38.prefix.fa.gz`, and every GRCh38 FASTA on jbrowse.org) is the bare `6`,
  // while the graph's stable names are `GRCh38#0#chr6`, and the plugin's
  // `GetSubgraph` RPC did no refName renaming, so the launch resolved nothing and
  // opened a view reading "0 nodes, 0 edges" with no error. Fixed in the plugin
  // by extending `RpcMethodTypeWithRenameRegion`, and the hosted bundle now
  // carries that fix (its `GetSubgraph` extends the renaming base class), so this
  // could be switched to the driven form; it stays declarative because a launch
  // flow buys this particular figure nothing that
  // pangenome/rgfa_segment_neighbourhood does not already document. E. coli was
  // unaffected either way, its assembly refName
  // `chr` matching the graph's `K12#1#chr`, which is why the driven figures above
  // are on E. coli.
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
              // compact/longest-isoform, as everywhere else in this set: at the
              // default glyph mode the C4A/C4B duplication stacks deep enough
              // that the lane's last row is clipped by the one below it
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 70,
            },
            {
              trackId: 'hprc_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              height: 90,
            },
            hprcSegmentsLane(C4_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: C4_REGION,
          // The Bandage picture, not the rank ladder: a force layout has no x
          // axis to share with the linear view, so color is the only thing that
          // can carry the correspondence, and the reference-position ramp is the
          // one coloring both panels can compute (referencePositionColor).
          layoutMode: 'force',
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    // 1215 before the gene lane went compact, 1155 before the layout was
    // seeded: the pane is sized to the drawing, so a different arrangement of
    // the same 30 nodes is a different pane height
    viewportHeight: 1166,
    hideTooltip: true,
  },

  // The KIV-2 repeat in LPA, picked out of the bubble index rather than off a
  // locus list. Every record in hprc-v2.0-mc-grch38.bubbles.bed.gz, ranked for a
  // bubble that is deeply traversed and still few enough segments to follow:
  // GRCh38 chr6:160,606,991-160,639,012 is 33 segments and 584 recorded paths,
  // and its alleles reach 176,236 bp against the 32 kb of reference they replace.
  // The window sits entirely inside LPA (160,531,482-160,664,275), whose KIV-2
  // copy number is the main determinant of Lp(a) and is not measurable off short
  // reads at all.
  //
  // An EXPANSION, deliberately, and that is a constraint on the picture rather
  // than a preference. The other standout in the same scan is the CFHR3/CFHR1
  // deletion at chr1:196,753,088-196,837,771, whose bubble runs from 0 bp — two
  // named genes a fifth of haplotypes do not carry — and none of the three
  // displays draw it: sample rows gives a carrier an empty row (a deletion
  // contributes no segment), the anchored layout draws its edge flat along the
  // backbone under the backbone, and the callset paints the whole bubble alt for
  // nearly every haplotype. Extra sequence has somewhere to be drawn; missing
  // sequence does not. See website/scripts/screenshot-review-plan.md.
  {
    mode: 'url',
    name: 'pangenome/hprc_lpa_kiv2',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: LPA_WINDOW,
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 70,
            },
            {
              trackId: 'hprc_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              height: 80,
            },
            hprcSegmentsLane(LPA_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: LPA_REGION,
          layoutMode: 'samplerows',
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector:
      'body:has([data-testid="graph-row-label"]) [data-testid="graph-layout-select"]',
    readyTimeout: 180000,
    settleMs: 6000,
    viewportWidth: 1000,
    // the linear stack plus the graph pane, which sizes itself to its rows
    viewportHeight: 1045,
    hideTooltip: true,
  },

  // The two products at one locus, which is the argument the HPRC tutorial
  // closes on ("the matrix for base-level variation across haplotypes, the
  // graph for how the sequence rearranges") and had no picture of.
  //
  // Both panels are one row per haplotype, which is what makes them comparable
  // at a glance and is the whole reason the graph pane is in sample-rows
  // layout: above, the haplotypes minigraph took each allele FROM, below, the
  // haplotypes the callset says CARRY each allele. The graph cannot answer the
  // second question at all — it collapses identical sequence, so an allele
  // records one donor however many samples walk it — and that gap is the point
  // the tutorial makes.
  //
  // The callset is filtered to the structural tier so the two hold the same
  // class of event: minigraph collapses everything under ~50 bp, and
  // `alleleLength(feature) >= 50` takes the VCF to the same tier (a span filter
  // would keep deletions only, since an insertion consumes no reference).
  //
  // The regular multi-sample display, not the matrix: these columns have to
  // land under the graph rows above them, and matrix mode spreads columns
  // evenly across the width, which would break exactly the correspondence this
  // figure is for.
  //
  // Review: "hard to see the way the SV track relates to the graph". Root
  // cause wasn't color (the segments lane above the callset already carries
  // hprcSegmentsLane's reference-position ramp) but SCALE: the callset held
  // all 464 haplotypes while the graph's sample-rows layout draws only the
  // donors that actually walk a non-reference path here, ~12 of them, so nine
  // in ten callset rows had nothing to compare against and the 12 that
  // mattered were lost in the stack. `MHC_CALLSET_LAYOUT` restricts the
  // callset to that same 10-donor set (both haplotypes each, so a reference-
  // only sibling row is visible next to a carrier row rather than silently
  // dropped), pulled from the segments/links tabix over the identical
  // MHC_CLASSII_REGION window (`tabix hprc-v2.0-mc-grch38.links.bed.gz
  // 'GRCh38#0#chr6:32510000-32600000'`, every non-reference column). Fixed
  // list rather than `runClustering`: a preset `layout` is what makes the row
  // SET match the graph's, which clustering (free to reorder/include any of
  // the 464) can't guarantee.
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
            hprcSegmentsLane(MHC_CLASSII_REGION),
            {
              trackId: 'hprc2_wave_grch38',
              type: 'LinearMultiSampleVariantDisplay',
              height: 260,
              jexlFilters: SV_FILTER,
              layout: MHC_CALLSET_LAYOUT,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: MHC_CLASSII_REGION,
          layoutMode: 'samplerows',
          colorScheme: 'reference-position',
        },
      ],
    }),
    // two signals, ANDed: the graph's rows drawn, and the callset's own fetch
    // finished (not just first paint). A bare comma list would be a CSS OR and
    // fire on whichever landed first.
    readySelector:
      'body:has([data-testid="graph-row-label"]):has([data-testid="graph-layout-select"]) [data-testid="variant-display-done"][data-display-phase="ready"]',
    readyTimeout: 360000,
    settleMs: 5000,
    viewportWidth: 1000,
    // the gene lane, the segments lane, the 20-row callset, and the graph's
    // rows under them
    viewportHeight: 1330,
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
    url: ecoliSampleRowsSession(),
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
  // highlights the node.
  //
  // One figure, both directions, because separately they were two nearly
  // identical pictures of the same window making the same point, and the point
  // is the reciprocity: the pair says the two views agree whichever end you
  // touch, which neither frame says alone. They also drew the same review note
  // twice ("hard to figure out correspondence between linear and graph").
  //
  // The directions run through different code, which is why both are worth
  // capturing. Graph to linear ends in a band drawn from real coordinates
  // (`getHighlightCoords`); linear to graph goes the other way — an LGV
  // publishes `{hoverPosition, hoverFeature}` to session.hovered and the graph's
  // own autorun matches it (hoverSync/lgvHover). Both frames assert the same
  // `graph-node-highlight` testid, which is what makes this a round trip rather
  // than a screenshot of a tooltip.
  //
  // Frame two hovers a GENE rather than the graph's own segments track on
  // purpose. A segment feature matches by name, the easy path; a gene supplies
  // only a coordinate, so it exercises the fallback that finds the backbone
  // segment covering it — the case that makes the correspondence useful from any
  // track rather than only from the graph's own.
  //
  // A hover figure has no cursor in it, so each frame rings its own target:
  // without that the reader sees a band appear with nothing saying what caused
  // it. Frame one's ring is drawn at the same coordinate the hover uses (the
  // graph is canvas, so there is no element to anchor to — the one case where a
  // raw x/y is the input being echoed rather than a hand-measurement); frame
  // two's is anchored to the gene label the hover targets.
  {
    mode: 'url',
    name: 'pangenome/rgfa_hover_sync',
    url: ecoliSampleRowsSession(),
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
    stages: [
      {
        // The hover target is a bare viewport coordinate because the graph is
        // canvas. It is stable here in a way it would not be on the FMMM layout
        // — sample rows is deterministic, computed from SN/SO/SR, so the allele
        // sits at the same place every run.
        actions: [
          { type: 'delay', ms: 3000 },
          { type: 'hover', from: HOVERED_ALLELE },
          {
            type: 'waitForSelector',
            selector: '[data-testid="graph-node-highlight"]',
          },
          { type: 'delay', ms: 1000 },
        ],
        annotations: [
          {
            type: 'circle',
            x: HOVERED_ALLELE.x,
            y: HOVERED_ALLELE.y,
            radius: 18,
          },
        ],
      },
      {
        actions: [
          // by the gene's own rendered label, so nothing here is a viewport
          // coordinate measured off a previous capture
          { type: 'hover', selector: '[data-testid="feature-name-csgG"]' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="graph-node-highlight"]',
          },
          { type: 'delay', ms: 1000 },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { selector: '[data-testid="feature-name-csgG"]' },
          },
        ],
      },
    ],
  },

  // The other half of the way out, on the graph where the contributing
  // assemblies are NOT loadable: right-clicking one haplotype's allele. Its own
  // coordinate is exact and unopenable (no session loads 464 haplotypes as
  // assemblies), so what the menu offers is the GRCh38 interval the allele
  // attaches to, which is the answer the HPRC tutorial's round trip needs.
  //
  // Two frames, because the menu's first item is new and its result is the
  // thing worth showing. Review: "need to be able to just highlight
  // lineargenomeview coords". Hovering a node already draws a band in the
  // linear view, but a hover band lives as long as the pointer does and cannot
  // be pointed at afterwards; **Highlight in hg38** writes
  // the same interval into the view's own highlight list, where it stays. The
  // second frame is that highlight, cropped to the linear view so the band is
  // the subject.
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
            hprcSegmentsLane(MHC_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: MHC_REGION,
          layoutMode: 'samplerows',
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector:
      'body:has([data-testid="graph-row-label"]) [data-testid="graph-layout-select"]',
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    viewportHeight: 830,
    actions: [
      // the auto-fit has to have finished before a coordinate means anything
      { type: 'delay', ms: 2000 },
    ],
    stages: [
      // A `stages` capture stacks the stage frames and nothing else, so the
      // right-click lives here rather than in `actions` above — which is setup
      // for stage one, not a frame of its own.
      {
        actions: [
          { type: 'rightclick', from: HPRC_ALLELE },
          { type: 'waitForText', text: 'Node details' },
          { type: 'delay', ms: 500 },
        ],
      },
      {
        // the linear view alone, so the band is the subject rather than a strip
        // above a graph pane that no longer has anything to say. Deep enough to
        // hold the whole segments lane, since the band crosses both lanes
        viewportHeight: 405,
        actions: [
          { type: 'click', text: 'Highlight in hg38' },
          { type: 'delay', ms: 1500 },
        ],
      },
    ],
  },

  // The way back out of the graph, on the one fixture where it can do more than
  // return to the reference: all five strains loaded as assemblies, so the graph
  // offers a linear view of each contributing strain at its own coordinates, and
  // a synteny view of all of them at once.
  //
  // Two frames, because the menu on its own only shows that the offer exists
  // (reviewer: "a two part screenshot showing the next stage ... could be
  // useful"). The second is the synteny launch rather than a per-strain linear
  // one: it is the entry that makes the whole claim at once — four panels, each
  // already at that strain's own locus, from the segments' SN/SO tags with
  // nothing looked up in an alignment first. A per-strain launch opens on
  // `No tracks active` (showInLinearView only carries the graph's own track
  // across, and that is configured for the reference alone), so its frame would
  // be an empty view.
  //
  // The graph is the only view in the session. It used to sit under a K12 linear
  // view, which pushed the cascade into the lower half of a 700px frame and made
  // the figure "quite `large`!" for a menu — and with a second frame stacked
  // under it that context would have been paid for twice.
  //
  // Driven through the view menu by text rather than by canvas coordinates, so
  // nothing here is measured off a previous capture.
  {
    mode: 'url',
    name: 'pangenome/rgfa_launch_out_menu',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      views: [
        {
          // pinned so the actions and the callout can scope to this view rather
          // than to whichever view the launch adds beside it
          id: 'launch_out_graph',
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: LAUNCH_OUT_REGION,
          layoutMode: 'samplerows',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: '[data-testid="graph-row-label"]',
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    // covers the taller second frame (the graph plus the five-panel synteny view
    // it launches); the menu frame sets its own below. An exact fit: the bottom
    // panel is the last row, so nothing is drawn under its ruler
    viewportHeight: 940,
    hideTooltip: true,
    stages: [
      {
        // The graph pane plus the cascade hanging off its menu, and little page
        // background under them. This is also the viewport stage two ACTS in —
        // a stage resizes after its own actions — and below ~430 the synteny
        // item click stops launching anything (verified at 350 and 410: the
        // debug capture shows the menu dismissed and no view added). Cause not
        // established; treat 430 as a measured floor rather than a tidy number.
        viewportHeight: 430,
        actions: [
          {
            type: 'click',
            selector: `${LAUNCH_OUT_VIEW} [data-testid="view_menu_icon"]`,
          },
          { type: 'click', text: 'Launch view' },
          // expand the per-strain list rather than leaving it a closed submenu
          // row, which is the half of the menu the figure is about
          { type: 'hover', text: 'Linear genome view' },
          { type: 'waitForText', text: 'CFT073 chr:' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'box',
            // the menu the cascade hangs off, which is otherwise the one thing
            // in the frame a reader has to find before any of it is reachable
            anchor: {
              selector: `${LAUNCH_OUT_VIEW} [data-testid="view_menu_icon"]`,
            },
          },
        ],
      },
      {
        // Re-opened from scratch rather than clicked out of the cascade stage
        // one left standing: the frames differ in height, and the resize that
        // buys frame one its tight crop lands between the two stages and moves
        // the menu under it — the synteny row was then clicked at its old
        // position and nothing launched.
        closeMenusFirst: true,
        // stated even though it matches the spec's own: a stage only resizes
        // when it names a height, so without this the frame keeps the tight
        // crop stage one left behind and the synteny view lands below it
        viewportHeight: 940,
        actions: [
          {
            type: 'click',
            selector: `${LAUNCH_OUT_VIEW} [data-testid="view_menu_icon"]`,
          },
          { type: 'click', text: 'Launch view' },
          { type: 'click', text: 'Linear synteny view' },
          // the ribbons, not the panels: the panel headers paint long before
          // the PAF the whole point of the launch is
          {
            type: 'waitForSelector',
            selector: '[data-testid="synteny_canvas_done"]',
            timeout: 120000,
          },
          { type: 'delay', ms: 8000 },
        ],
      },
    ],
  },

  // The other entry in that menu, and the one that makes the graph's claim
  // checkable: the graph says CFT073 carries 58,692 bp at K12's asnW/asnU/asnV
  // tRNA cluster that the reference does not, and clicking `CFT073 chr:…` opens
  // that sequence on CFT073's own coordinates, where it is the colibactin (pks)
  // island — clbA to clbS, the genotoxin operon, in a strain isolated from a
  // pyelonephritis patient.
  //
  // Three views, one per corner of the trip. The reference above states where on
  // K12 this is (the tRNAs, and the segments lane going quiet where CFT073's
  // sequence has nowhere to sit on the reference axis); the graph states that
  // something is there and how much; the launched view names it. No alignment is
  // consulted anywhere in that chain — the coordinates come off the segments'
  // own SN/SO tags.
  //
  // The launched panel carries CFT073's gene track because the launch now brings
  // the session's annotation for the assembly it opens on; before that it opened
  // on `No tracks active` and this figure could not have existed.
  {
    mode: 'url',
    name: 'pangenome/rgfa_strain_launch',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PKS_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              height: 55,
            },
          ],
        },
        {
          // pinned so the menu click scopes to the graph rather than to the
          // linear view above it or the one the launch adds below
          id: 'pks_graph',
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: PKS_REGION,
          layoutMode: 'samplerows',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: '[data-testid="graph-row-label"]',
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    // the three views; the graph pane sizes itself to its rows, and the launched
    // panel's gene track runs two rows deep at this width
    viewportHeight: 925,
    hideTooltip: true,
    actions: [
      {
        type: 'click',
        selector: `${PKS_VIEW} [data-testid="view_menu_icon"]`,
      },
      { type: 'click', text: 'Launch view' },
      { type: 'hover', text: 'Linear genome view' },
      { type: 'waitForText', text: 'CFT073 chr:' },
      { type: 'click', text: 'CFT073 chr:' },
      // a gene of the island itself, so the wait cannot pass on a view that
      // opened empty — which is exactly what this figure exists to show it does
      // not do any more. clbK is 6.5 kb, the widest of them, so its label is the
      // first to render.
      {
        type: 'waitForSelector',
        selector: '[data-testid="feature-name-clbK"]',
        timeout: 120000,
      },
      { type: 'delay', ms: 2000 },
    ],
  },
]
