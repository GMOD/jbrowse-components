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

// The tracked fixtures, whose `esmUrl` is the published, content-addressed
// plugin bundle. Their `*_local.json` siblings point that url at a local
// `pnpm build` of the plugin instead and are gitignored, so a spec naming one
// renders here and gives the reader a live link to a config that exists on no
// server (checked by `pnpm check-live-configs`). Iterate against a local plugin
// build by setting GRAPH_PLUGIN_LOCAL=1, and switch back before committing
// figures.
const local = process.env.GRAPH_PLUGIN_LOCAL
  ? (name: string) => name.replace(/\.json$/, '_local.json')
  : (name: string) => name
const CONFIG = local('test_data/graphgenomeview/config.json')
// The only fixture loading the graph's contributing strains as assemblies,
// which is what the outbound launch needs: a node can open the strain it came
// from, and the window can open as a synteny view of the strains in it.
const ECOLI_PANGENOME_CONFIG = local(
  'test_data/graphgenomeview/ecoli_pangenome.json',
)
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

// What the graph paints an off-reference allele in its 'Reference position'
// scheme (REFERENCE_RAMP_ALT_COLOR in the plugin's GeometryBuilder). Hoisted so
// the linear lane's jexl and the prose below name one color.
const ALT_ALLELE_COLOR = 'rgb(60,65,72)'

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

// The per-strain window, which cannot be the kilobase above (review of the sample
// rows figure: "too chaotic. too many tiny segments ... I know it shows the per
// sample rows but i just dont get it"). pggb cuts a segment at every variant, so
// that window is 154 nodes -- about 6 px each, and a row of 6 px marks says
// nothing about what a strain carries. This is the window local_subgraph draws,
// where the same index returns 37 segments, the long ones are 59 and 158 bp, and
// the strains genuinely differ: CFT073's contig only reaches the last 293 bp
// (`tabix ecoli_pggb.segs.bed.gz 'K12#1#chr:1004500-1004961'`, whose sixth column
// lists the strains carrying each segment), so its row starts where it joins and
// the tutorial already explains that boundary as ycbF ending and pyrD starting.
const PGGB_ROWS_LOCUS = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1004500,
  end: 1004961,
}
const PGGB_ROWS_WINDOW = 'chr:1,004,500-1,004,961'

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
const PATHS_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1088000,
  end: 1104000,
}
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

// CFT073's allele at PATHS_WINDOW's bubble — 65,410 bp, the longest thing in
// the cut and the one worth hovering. Named rather than measured: the hover and
// the ring drawn over it both resolve it through the view's own nodePositions
// (`anchor: { graphNode }`), so neither goes stale when the layout, the pane
// size or the tracks above the graph move. `node scripts/probe-graph-nodes.ts
// pangenome/rgfa_hover_sync` prints the ids a cut contains.
const HOVERED_ALLELE = 's2037'

// The off-reference allele pangenome/hprc_node_menu right-clicks, named rather
// than measured — see HOVERED_ALLELE. `node scripts/probe-graph-nodes.ts
// pangenome/hprc_node_menu` prints the cut's ids with their lengths and ranks.
const HPRC_ALLELE = 's318599'

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
const ECOLI_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 4050000,
  end: 4100000,
}
const SEGMENT_LABEL = 's1277'
// ~2x the segment's own span, so its label is a comfortable right-click target
const SEGMENT_WINDOW = 'chr:4,054,000-4,066,000'

// The paa island, the one locus the all-vs-all synteny tutorial builds a figure
// around (multiway_synteny/ecoli_one_vs_all: three of four strains have no
// alignment to K12 across it, NCTC86 runs straight through). Review of that
// figure asked for the same locus as a graph, which is what this is — and the
// two readings agree, off the graph's own index rather than off the PAF:
//
//   tabix ecoli_minigraph.segs.bed.gz  'K12#1#chr:1440000-1475000'
//     s502  K12#1#chr:1,446,100-1,467,909   the 21.8 kb island itself, rank 0
//   tabix ecoli_minigraph_paths.bed.gz chr:1440000-1475000
//     K12      ref        >s502>s503>s504>s505   27,508 bp
//     NCTC86   -2,559     >s502>s2388>s504>s505  24,949 bp
//     CFT073   -21,393    >s2093>s2094>s2095      6,115 bp
//     IAI39    -21,478    >s2093>s2633>s2095      6,030 bp
//     Sakai    -21,691    >s1613>s505             5,817 bp
//
// So NCTC86 is the only strain whose path walks s502 — the segment carrying
// paaABCDEFGHIJK — and the other three take a detour under a quarter its length.
// A PAF says a lane stops; the graph says what the sequence does instead, and
// that is the figure.
//
// The window is the span the slice was cut on, wide enough that the bubble's
// flanking backbone (s501, s506) is in frame either side of it.
//
// The same span as numbers, which both the graph and the segments lane above it
// ramp their colors over — the one thing that makes the island the same green in
// each. It has to be stated to the graph, not read off it: a file-loaded graph
// has no `loadedRegion`, so its ramp otherwise spans whatever the file holds,
// which for a gfatools cut is the first and last backbone node's midpoints
// rather than the window. The view takes `colorDomain` for that.
const PAA_RAMP_DOMAIN = { start: 1445000, end: 1474500 }

// The same span as a region, for the figures that cut it out of the track's own
// indexes rather than loading the gfatools slice as a file.
const PAA_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  ...PAA_RAMP_DOMAIN,
}

// s502's own span out of the segs index (`tabix ecoli_minigraph.segs.bed.gz
// 'K12#1#chr:1445000-1474500'` -> 1,446,100-1,467,909), so the segment carrying
// paaABCDEFGHIJK is marked from the file rather than by eye. 21,809 bp, which is
// the `21.8 kb` label the graph draws on the same segment's node: the one number
// tying the linear panel to the graph in the figures that show both.
const PAA_ISLAND_HIGHLIGHT = {
  refName: 'chr',
  start: 1446100,
  end: 1467909,
  color: 'rgba(214,137,16,0.13)',
}

// The same span as a locstring, for a linear view placed over one of these cuts:
// the window has to be the cut's own region, or the lane's ramp and the graph's
// run over different spans and the shared hue stops meaning anything.
const PAA_WINDOW = `chr:${PAA_RAMP_DOMAIN.start}-${PAA_RAMP_DOMAIN.end}`

// The synteny rows above the graph. K12's window is PAA_RAMP_DOMAIN opened out a
// little on the left, so the reader sees the Sakai band ARRIVE at the island's
// right edge rather than starting at the frame's. The two partner windows are
// the same span carried across each strain's own alignment to K12 in
// ecoli_pggb_ava (`tabix ecoli_pggb_ava.pif.gz 'tK12#1#chr:1430000-1490000'`):
//
//     NCTC86  K12 1,434,958-1,632,337 <-> NCTC86 1,698,328-1,898,776
//     Sakai   K12 1,474,100-1,632,416 <-> Sakai  1,990,000-2,158,448
//
// which is the whole argument in two rows of a file: NCTC86's block starts left
// of the island and runs straight through it, and Sakai has no block over the
// island at all — its nearest one starts 6 kb past the island's right edge.
const PAA_SYNTENY_WINDOW = 'chr:1,432,000-1,482,000'
const PAA_NCTC86_WINDOW = 'chr:1,695,300-1,746,100'
const PAA_SAKAI_WINDOW = 'chr:1,945,200-1,998,400'
const ECOLI_AVA_TRACK = 'ecoli_pggb_ava'
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
const HPRC_CONFIG = local('test_data/graphgenomeview/hprc.json')
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
// The amylase locus, framed on the inversion-flagged bubble the scan over
// hprc-v2.0-mc-grch38.bubbles.bed.gz turns up at chr1:103,611,080-103,732,636,
// with a little room either side so its flanks are on screen. 34 backbone
// segments and 113 links here, pulling 101 distinct nodes.
// The complement factor H cluster. CFH, CFHR3, CFHR1 and CFHR4 all fall in this
// 200 kb, and the graph holds three deletions across it.
const CFHR_WINDOW = 'chr1:196,700,000-196,900,000'
const CFHR_REGION = {
  refName: 'chr1',
  assemblyName: 'hg38',
  start: 196700000,
  end: 196900000,
}

const AMY_WINDOW = 'chr1:103,600,000-103,745,000'
const AMY_REGION = {
  refName: 'chr1',
  assemblyName: 'hg38',
  start: 103600000,
  end: 103745000,
}

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
// The one event pangenome/hprc_graph_vs_callset marks in both products: a
// 14,596 bp deletion, the largest record in the window that more than one donor
// carries. From the callset itself —
// `tabix hprc-v2.0-mc-grch38.wave.vcf.gz chr6:32510000-32600000`, longest REF
// among the records the SV filter keeps.
const MHC_MARKED_DELETION = '6:32,514,842-32,529,438'

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
// lineargenomeview and bandage graph it might help show correspondence".
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
// An off-reference segment comes off the ramp entirely and paints one flat
// charcoal, matching REFERENCE_RAMP_ALT_COLOR in the plugin. It used to keep the
// hue of the reference it replaces, paler (45%/72% against 70%/50%); review
// asked for "a non-spectrum coloring" for the non-backbone parts, because a hue
// on the ramp says the allele IS the reference at that position. On a lane over
// the REFERENCE that branch never fires — a rank>0 segment states its
// coordinates on its own stable sequence, so it is not in the window at all —
// and the pair of rows a dense lane draws is the layout packing rank-0 blocks,
// not rank. It is here for a lane opened on a contributing assembly, where those
// segments do appear, and so the ramp cannot disagree with the graph beside it.
// `rank` is what RgfaTabixAdapter puts on the feature; a track carrying none
// reads `undefined > 0` as false and stays on the ramp.
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
  return `jexl:get(feature,'rank')>0 ? '${ALT_ALLELE_COLOR}' : 'hsl(' + ${hue} + ',70%,50%)'`
}

// The HPRC segments lane, shared by every figure that carries it so they read
// the same. Labels off: the ids are the graph's own `s101124` counters, which
// name nothing a reader can look up, and at these widths the display spends
// three or four rows of text on them — in the 90 kb allele-inventory frame they
// covered more area than the blocks did. What the lane is for is the blue rank-0
// backbone tiling the reference.
//
// `heightMode: 'grow'` rather than a pinned height. The lane packs 2-4 rows
// depending on how the window's segments overlap, and a pinned 45 px fitted the
// thinnest of those: at MHC and at LPA the last row was cut by the lane's own
// bottom border and the display raised a scrollbar, so every one of these
// figures carried a clipped track and a scrollbar over the tracks. Growing to
// the content also drops the whitespace where a window packs into two rows,
// which a height picked for the worst case would have added everywhere else.
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
    heightMode: 'grow',
    color: referencePositionColor(domain),
  }
}

// The structural tier of the wave VCF, which is what makes it comparable to the
// graph: minigraph collapses everything under ~50 bp, so an unfiltered callset
// is thousands of SNP columns the graph never had. `alleleLength` rather than
// end-start because an insertion consumes no reference and a span filter would
// keep only deletions. Same filter the hprc2 matrix figures use.
const SV_FILTER = ['jexl:alleleLength(feature) >= 50']

// The hover figure's session: the genes and the graph's own segments over the
// bubble window, with the subgraph launched from that same track in the view's
// default force-directed drawing.
//
// Reference-position colors on both panels, over the same window (review:
// "might want to use rainbow coloring of nodes"). The tutorial argues for
// exactly this a section later — the ramp is the one scheme a linear track can
// reproduce, because it is a function of two numbers and a midpoint — and these
// are the figures where the argument has to be visible: the block above and the
// node below are the same color at the same bp. The rank scheme stays on
// pangenome/rgfa_segment_neighbourhood, whose subject IS rank.
function ecoliHoverSession() {
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
            color: referencePositionColor(PATHS_REGION),
          },
        ],
      },
      {
        type: 'GraphGenomeView',
        loadedTrackId: ECOLI_SEGMENTS_TRACK,
        loadedRegion: PATHS_REGION,
        colorScheme: 'reference-position',
      },
    ],
  })
}

// The pggb pair: the same track in two anchored layouts. Both name their layout,
// because the view's own default is the force drawing, and each takes its own
// window: a kilobase is the right scale for the backbone sweep and far too dense
// for per-strain rows (see PGGB_ROWS_LOCUS).
function pggbLocusSession(
  layoutMode: 'auto' | 'samplerows',
  { region, window }: { region: typeof PGGB_LOCUS; window: string },
) {
  return sessionSpec(CONFIG, {
    sessionTracks: [K12_GENES_SESSION_TRACK, PGGB_SEGMENTS_SESSION_TRACK],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: window,
        tracks: [
          { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
          {
            trackId: PGGB_SEGMENTS_TRACK,
            type: 'LinearBasicDisplay',
            // labels off: at this density they are hundreds of overlapping
            // integer ids, and the lane is here for the color sweep
            showLabels: 'off',
            height: 50,
            color: referencePositionColor(region),
          },
        ],
      },
      {
        type: 'GraphGenomeView',
        loadedTrackId: PGGB_SEGMENTS_TRACK,
        loadedRegion: region,
        layoutMode,
        colorScheme: 'reference-position',
      },
    ],
  })
}

// The layout trade, as one subgraph drawn twice — the halves of
// pangenome/hprc_mhc_anchored. The HPRC tutorial spends a paragraph on the
// trade and its figure used to be the anchored half alone, captioned "the same
// subgraph in the anchored layout" against a force-directed figure of a
// DIFFERENT locus, so the pair the prose promised did not exist. Both halves are
// now the same window, the same tracks and the same colors, differing only in
// layoutMode: the anchored one's backbone lines up under the linear view, the
// force one does not and shows the graph's shape instead.
//
// Reference-position colors on both, so a reader can check the axis claim
// without measuring (review: "just hard to figure out correspondence between
// linear and graph"): in the anchored half the segment above and the node below
// share an x AND a color, in the force half only the color survives.
//
// Each half is sized to its own content rather than to the taller of the two:
// `+append` pads the shorter one, so the composite carries the difference as
// background while each half stays a right-sized figure on its own live link.
// The force drawing is about as tall as it is wide; the anchored one is seven
// rank rows.
// The halves of pangenome/graph_context: the paa island cut from the segments
// track twice, at Graph context None and at 1 hop. Same window, same track, same
// colors; the second one follows each off-reference segment's own links one step
// further, which is what turns the dangling arms into bubbles.
//
// Each half carries the linear view the cut was made from (review: "I don't
// particularly understand the difference here. At the very least it needs a
// lineargenomeview"). Two graph drawings alone state the difference only as a
// node count in the header: FMMM lays the same window out differently once nodes
// are added, so the two tangles do not visibly share a single node. With the
// island's genes and the segments lane above each one, both halves are the same
// stretch of K12 twice over, and the added nodes are the ones with no block in
// the lane above them.
//
// That also settles the coloring: a graph shown beside a linear view uses
// reference position, so the backbone thread and the blocks above it are the same
// hue at the same bp, and every off-reference node is the one flat charcoal
// (ALT_ALLELE_COLOR) — which is what makes "the added nodes are off-reference"
// visible rather than asserted. Stable rank was the coloring while these were
// graph panes alone.
function graphContextPartSpecs(): ScreenshotSpec[] {
  const part = (name: string, subgraphContext: number): ScreenshotSpec => ({
    mode: 'url',
    name,
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PAA_WINDOW,
          // No island highlight here, though rgfa_paa_bubble carries one: this
          // window IS the cut, so s502 is 21.8 kb of 29.5 and the band covers
          // three quarters of the panel, reading as a background tint rather
          // than as a mark. The block's own green and the `21.8 kb` label on the
          // green node below are what tie the two panels together.
          tracks: [
            {
              trackId: 'K12_genes',
              type: 'LinearBasicDisplay',
              showOnlyGenes: true,
              displayMode: 'compact',
              showDescriptions: false,
              height: 60,
            },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              showLabels: 'off',
              heightMode: 'grow',
              color: referencePositionColor(PAA_RAMP_DOMAIN),
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: PAA_REGION,
          layoutMode: 'force',
          colorScheme: 'reference-position',
          bubbleSpread: 'open',
          subgraphContext,
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    // the 1 hop half fires a tabix query per off-reference segment already
    // reached, so it fetches for longer than the plain cut does
    readyTimeout: 180000,
    allowUnsettled: true,
    settleMs: 8000,
    // half the composed width each
    viewportWidth: 750,
    // the linear view's two lanes on top of the graph pane the halves used to be
    // (the 1 hop cut is the taller drawing of the two, so it sets this)
    viewportHeight: 1006,
    hideTooltip: true,
  })
  return [
    part('pangenome/graph_context_none', 0),
    part('pangenome/graph_context_hop1', 1),
  ]
}

// The halves of pangenome/local_subgraph: the same pggb subgraph over the same
// linear view, anchored on the K12 path and force-directed. The anchored half is
// the figure's original claim (the strip's green-to-yellow step is the same step
// in the graph's backbone, at the same x); the force half is what the drawing
// looks like with nothing holding it to that axis, which is what makes the claim
// legible as a choice.
//
// One height for both, because `+append` pads the shorter one: the anchored
// layout sizes its pane to two rows and the force drawing is much taller, so the
// height is the force one's and the anchored half carries the difference as page
// background.
function localSubgraphPartSpecs(): ScreenshotSpec[] {
  const part = (
    name: string,
    layoutMode: 'auto' | 'force',
    viewportHeight: number,
  ): ScreenshotSpec => ({
    mode: 'url',
    name,
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
          layoutMode,
          referencePath: 'K12',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    allowUnsettled: true,
    settleMs: 8000,
    // half the composed width each
    viewportWidth: 830,
    // Each half sized to its own content, not to the taller of the two: the
    // anchored layout has a pinned aspect ratio — row spacing is a fraction of
    // the reference span — so its pane is two rows, while the force drawing
    // fills a 600px box. `+append` pads the shorter one to match, so the
    // composite carries the difference as background while each half stays a
    // right-sized figure on its own live link.
    viewportHeight,
    hideTooltip: true,
  })
  return [
    part('pangenome/local_subgraph_anchored', 'auto', 640),
    part('pangenome/local_subgraph_force', 'force', 1025),
  ]
}

function mhcLayoutPartSpecs(): ScreenshotSpec[] {
  const part = (
    name: string,
    layoutMode: 'auto' | 'force',
    viewportHeight: number,
  ): ScreenshotSpec => ({
    mode: 'url',
    name,
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,500,000-32,560,000',
          // Genes and the segments lane only. The bubbles lane was here too and
          // came out badly at this window: the class II bubble runs the whole
          // width and the five small ones pack against the right edge, where
          // each of their two label lines is cut off horizontally, which no
          // height fixes. Nothing in this figure's caption reads the lane
          // either - it is about the axis the graph shares with the tracks -
          // and pangenome/hprc_c4_subgraph and hprc_lpa_kiv2 both carry the
          // bubbles lane on windows where its labels fit.
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 70,
            },
            hprcSegmentsLane(MHC_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: MHC_REGION,
          layoutMode,
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    settleMs: 4000,
    // half the composed width each
    viewportWidth: 820,
    viewportHeight,
    hideTooltip: true,
  })
  return [
    part('pangenome/hprc_mhc_layout_force', 'force', 1055),
    part('pangenome/hprc_mhc_layout_anchored', 'auto', 775),
  ]
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
    url: pggbLocusSession('auto', {
      region: PGGB_LOCUS,
      window: PGGB_LOCUS_WINDOW,
    }),
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
  // Same track and same colors as the figure above, at PGGB_ROWS_LOCUS rather than
  // at its kilobase: rows are what this figure is for, and a row has to be
  // readable segment by segment. Here the five rows differ from each other in
  // ways a reader can name -- CFT073 absent from the left half of the window, the
  // 1 bp nodes taken by some strains and not others.
  {
    mode: 'url',
    name: 'pangenome/pggb_locus_sample_rows',
    url: pggbLocusSession('samplerows', {
      region: PGGB_ROWS_LOCUS,
      window: PGGB_ROWS_WINDOW,
    }),
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
  ...localSubgraphPartSpecs(),
  {
    mode: 'compose',
    name: 'pangenome/local_subgraph',
    parts: [
      'pangenome/local_subgraph_anchored',
      'pangenome/local_subgraph_force',
    ],
    // Left+right, per review ("should have the force directed bandage graph
    // version also. potentially as a 'left+right' two part image"). The anchored
    // half is the one that makes the shared-axis claim, so it goes first; the
    // force half is the same subgraph with nothing holding it to the axis, which
    // is what says the axis in the other half is a real thing rather than the
    // only way a graph can be drawn.
    direction: 'horizontal',
  },
  // The indexed route on the tutorial's own four-strain graph: the rGFA
  // segments as a feature track over a 50 kb K12 window, and the subgraph the
  // launch menu cuts from that same window below it. Same two tabix indexes
  // feed both, so the segment ids above are the nodes below, and since this is
  // the first figure on the page, the same reference-position ramp too: the
  // window and the cut region are the same 50 kb, so a block and its node land
  // on the same hue. The track is
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
          tracks: [
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              color: referencePositionColor(ECOLI_REGION),
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: ECOLI_REGION,
          // stated, unlike a launch taken by hand, which now opens on the force
          // default: this figure is the shared-axis claim, and the drawing has to
          // be the one that shares the axis
          layoutMode: 'auto',
          colorScheme: 'reference-position',
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
  // The paa island as a bubble — the graph answer to the all-vs-all synteny
  // figure, on the same locus (the comment above PAA_RAMP_DOMAIN records the two
  // indexes it was read off). Force-directed, because what a reader is being shown is the
  // SHAPE: one long backbone node with the rest of the graph looping past it.
  // An anchored layout draws that loop flat against the backbone it replaces,
  // which is the same drawing problem deletions have everywhere in these
  // figures (see hprc_cfhr_deletion).
  //
  // The panel above the graph is a THREE-ROW SYNTENY VIEW, not a bare linear
  // view (review: "use a linearsyntenyview instead of just lineargenomeview,
  // showing how it is a big insertion not in the others"). A single linear view
  // could show the island's genes and the segment carrying them, but nothing in
  // it said the other strains lack it — that claim lived only in the caption.
  // With NCTC86 above K12 and Sakai below, both bands are against K12 and the
  // two behaviours are side by side in one frame. See PAA_SYNTENY_WINDOW for the
  // alignment rows the partner windows come from.
  //
  // Reference-position colors over PAA_RAMP_DOMAIN, so the segments lane above
  // and the nodes below are the same hue for the same bp: the island is one wide
  // green block in the lane and the one long green node in the graph.
  //
  // The highlight is s502's own span from the segs BED, so the gene block, the
  // segment and the node are one object rather than three things a reader has to
  // line up by eye.
  {
    mode: 'url',
    name: 'pangenome/rgfa_paa_bubble',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      sessionTracks: [ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearSyntenyView',
          // NCTC86 above K12 and Sakai below it, so both bands are against K12
          // (ribbons are drawn between neighbouring rows only). That ordering is
          // the figure's claim, per review: "use a linearsyntenyview instead of
          // just lineargenomeview, showing how it is a big insertion not in the
          // others". Top band runs unbroken across the island, bottom band
          // starts at its right edge.
          tracks: [[ECOLI_AVA_TRACK], [ECOLI_AVA_TRACK]],
          drawCurves: true,
          levelHeights: [150, 150],
          // the two partner rows carry no tracks, and their empty-state block is
          // a centered button that reads as content
          collapseEmptyRows: true,
          views: [
            { assembly: 'NCTC86', loc: PAA_NCTC86_WINDOW },
            {
              assembly: 'K12',
              loc: PAA_SYNTENY_WINDOW,
              highlight: [PAA_ISLAND_HIGHLIGHT],
              tracks: [
                {
                  trackId: 'K12_genes',
                  type: 'LinearBasicDisplay',
                  showOnlyGenes: true,
                  displayMode: 'compact',
                  showDescriptions: false,
                  height: 60,
                },
                {
                  trackId: ECOLI_SEGMENTS_TRACK,
                  type: 'LinearBasicDisplay',
                  color: referencePositionColor(PAA_RAMP_DOMAIN),
                  height: 50,
                },
              ],
            },
            { assembly: 'Sakai', loc: PAA_SAKAI_WINDOW },
          ],
        },
        {
          type: 'GraphGenomeView',
          // A file, not the index, because the two cuts are different
          // operations and this figure wants an exact hop radius on the graph.
          // `gfatools view -R … -r 1` walks the graph itself; the launch's own
          // cut walks coordinate intervals (`subgraphContext`), which at 1 hop
          // does close all four of this bubble's detours but also brings
          // flanking backbone the file leaves out. See
          // scripts/build_ecoli_pangenome_graph.sh, which writes this file.
          gfaLocation: { uri: `${DATA}/ecoli_paa_subgraph.gfa` },
          layoutMode: 'force',
          colorScheme: 'reference-position',
          colorDomain: PAA_RAMP_DOMAIN,
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    viewportHeight: 1400,
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
        // the two rows the next stage clicks, so the frame states the path
        // rather than just the menu
        annotations: [
          {
            type: 'box',
            anchor: {
              selector: '[data-testid="cascading-submenu-launch_view"]',
            },
          },
          {
            type: 'box',
            anchor: {
              selector:
                '[data-testid="cascading-menuitem-graph_genome_view_(this_segment)"]',
            },
          },
        ],
      },
      // A launch through the menu opens on the view's own defaults, so the graph
      // arrives in one uniform color; the rank colors the sibling figures were
      // given declaratively are a Color-dropdown step here, and the tutorials
      // tell the reader to take it. Driving it keeps the two halves of this
      // figure comparable and makes the step itself part of what is documented.
      // The dropdown has no testid, so it goes by its current value, which
      // appears nowhere else on the page.
      //
      // The layout is the view's default too, which is now the Bandage
      // force-directed drawing. Review, on the anchored frame this used to
      // capture: "this should be bandage graph. the linear backbone is just
      // confusing." A 13-node neighbourhood is exactly the size where the force
      // drawing reads as a bubble — one route through the segment, one around it
      // — where the anchored one collapsed both onto the reference axis and made
      // the alleles short bars hanging under a line.
      {
        // taller than the anchored frame this replaces (345px): a force drawing
        // is about as tall as it is wide, where the anchored one was three flat
        // rows. Measured against the run's below-the-fold report, which caught
        // 176px cut at 560.
        viewportHeight: 740,
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

  ...mhcLayoutPartSpecs(),
  {
    mode: 'compose',
    name: 'pangenome/hprc_mhc_anchored',
    parts: [
      'pangenome/hprc_mhc_layout_force',
      'pangenome/hprc_mhc_layout_anchored',
    ],
    // LEFT AND RIGHT, not stacked. Review: "if this is a 'two part image'
    // (refers to 'the same subgraph') may want to make it a split left+right
    // image". It reads as a pair because the caption said "the same subgraph in
    // the anchored layout" while the figure above it was a different locus
    // (amylase, chr1) drawn force-directed — so the pair the prose promised did
    // not exist and this figure was one half of it. Now both halves are the
    // same subgraph, same window, same tracks, differing only in layoutMode, and
    // side by side is the orientation for "two ways of drawing one thing":
    // stacked, the second reads as the next step rather than as the alternative.
    direction: 'horizontal',
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
              // pinned, not grown: a bubble's label is two lines and the lane
              // packs few enough rows to fit them, so growing it only adds
              // whitespace under the last one. One row now that the lane is
              // filtered, so 90 was 30px of that whitespace.
              height: 60,
              // The bubble this figure is about, and not the 136 bp four-segment
              // one that also falls in the window. That one sits 6 kb from the
              // right edge, which is not enough room for its two label lines, so
              // it printed a sentence cut off mid-word — and the caption never
              // referred to it. `segmentCount` is a field on the bubble feature
              // (MinigraphBubbleAdapter), so this filters on the same number the
              // label leads with.
              jexlFiltersSetting: ["jexl:get(feature,'segmentCount') >= 5"],
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
          // Bandage's own floor ('auto'), not a raised one. Raising it was
          // tried here and reviewed down: at 'open' (2.5x) and 'wide' (10x) the
          // 30 nodes' alt arms get long enough to stop closing into lenses, so
          // the drawing reads as splayed spaghetti rather than as bubbles on a
          // backbone -- "the bubble shapes have changed ... i dont like this".
          // The raised floor stays on hprc_cfhr_deletion and
          // hprc_amylase_graph, which have the node counts it was measured for.
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    // 1215 before the gene lane went compact, 1155 before the layout was
    // seeded, 1166 before the segments lane grew to its third row: the pane is
    // sized to the drawing, so a different arrangement of the same 30 nodes is
    // a different pane height
    viewportHeight: 1176,
    hideTooltip: true,
  },

  // CFHR3/CFHR1: the deletion figure, and the locus this spec file used to say
  // could not be drawn. The note is still in hprc_lpa_kiv2 below -- "sample rows
  // gives a carrier an empty row (a deletion contributes no segment), the
  // anchored layout draws its edge flat along the backbone under the backbone
  // ... Extra sequence has somewhere to be drawn; missing sequence does not."
  // Deletion edges are what changed: a link between two backbone segments that
  // are not neighbours is red and thick, and hovering it says how many bp are
  // gone.
  //
  // Counted off the hosted link index, this window holds three of them, the
  // largest 84,683 bp -- CFHR3 and CFHR1 together, which is one of the
  // best-known common deletions in the human genome. The graph draws it as what
  // it is: a red edge that leaves the backbone before CFHR3 and rejoins it after
  // CFHR1, with the reference the deletion skips running underneath.
  //
  // 41 nodes, so the force layout has room to open every bubble.
  {
    mode: 'url',
    name: 'pangenome/hprc_cfhr_deletion',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: CFHR_WINDOW,
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 70,
            },
            hprcSegmentsLane(CFHR_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: CFHR_REGION,
          layoutMode: 'force',
          colorScheme: 'reference-position',
          bubbleSpread: 'open',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    viewportHeight: 1055,
    hideTooltip: true,
  },
  // The amylase locus on chr1, which is the figure for "this scales to a whole
  // chromosome". chr1 is 248 Mb and the graph holds 464 haplotypes of it; the
  // view fetches this 145 kb window out of two tabix indexes and draws 101
  // nodes, so nothing about the chromosome's size reaches the drawing. It is
  // also the locus where the graph's own bubble index disagrees with the
  // tutorial's prose: `hprc-v2.0-mc-grch38.bubbles.bed.gz` reports the bubble at
  // chr1:103,611,080-103,732,636 as 95 segments, alleles from 26,889 to 316,616
  // bp, **and inversion-flagged** — 246 of the graph's 130,510 bubbles carry
  // that flag and this is one of the largest.
  //
  // Force-directed with the bubbles opened, which is the whole point of the
  // pairing: AMY1 copy number is what the graph cannot state (minigraph records
  // the distinct sequence a bubble can hold, not how many times a haplotype
  // repeats it), so what is worth drawing here is the *shape* of the
  // alternatives rather than an x axis. The bubbles lane above carries the
  // length range that stands in for copy number.
  {
    mode: 'url',
    name: 'pangenome/hprc_amylase_graph',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: AMY_WINDOW,
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 70,
            },
            // No bubbles lane. Three bubbles land in this window and each label
            // is two lines ending in a combinatorial path count (269,401 through
            // the amylase bubble alone), so the right-hand two are cut off
            // *horizontally* and the lane raises a scrollbar — the same reason
            // hprc_mhc_anchored dropped it, and no height fixes it. A
            // `labels.description` jexl on the display does not override the
            // adapter's own second line, tried. The numbers are in the caption,
            // where they are selectable text.
            hprcSegmentsLane(AMY_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: AMY_REGION,
          layoutMode: 'force',
          colorScheme: 'reference-position',
          // 'open', not 'wide': at 63 nodes the wider floor grows the whole
          // drawing faster than it separates the bubbles, so zoom-to-fit takes
          // it to 8% and the lenses close again. 'wide' is for a window of a
          // dozen.
          bubbleSpread: 'open',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    viewportHeight: 1090,
    hideTooltip: true,
  },
  // The allele inventory, which the HPRC tutorial documents in JSON and had no
  // picture of. It is a BED read by an AlignmentsTrack, and that pairing is the
  // whole point: each row carries a CIGAR against the reference span it replaces
  // (2062M63348I), so the display packs the overlapping alleles into rows and
  // draws each insertion at the size it inserts instead of as a 1 bp box.
  //
  // The CFHR window, not amylase (review: "it is just too complex in this genome
  // region. we need a simpler region with less diversity"). Amylase is 22 alleles
  // of which four are tens of kb of insertion at nearly the same coordinate, so
  // the lane packed six rows of overlapping grey bars carrying five-digit labels
  // and the reader had to disentangle which bar belonged to which. This window
  // holds 16, and its structure is one 84,683 bp deletion with small insertions
  // scattered around it (`tabix hprc-v2.0-mc-grch38.alleles.bed.gz
  // chr1:196700000-196900000`).
  //
  // It is also the window hprc_cfhr_deletion draws as a graph, which is the
  // second reason to move: the arc that figure labels "skips 84.7 kb of
  // reference" is the -84,683 bar here, so the same event is a loop in one figure
  // and the span it covers in the other.
  //
  // What a ROW is, since the obvious reading is wrong and the reviewer asked for
  // sample names: rows are the display's packing of overlapping alleles, and the
  // track cannot carry haplotype rows at all. The BED's `firstSeenIn` is
  // minigraph's build order, not carriage -- an allele several haplotypes share
  // is attributed to whichever was added first, so rows keyed on it would read as
  // a haplotype pileup while stating something else (build_rgfa_alleles.sh says
  // this at the field). Per-haplotype carriage is the callset's, which is what
  // hprc_graph_vs_callset draws.
  {
    mode: 'url',
    name: 'pangenome/hprc_allele_inventory',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: CFHR_WINDOW,
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 70,
            },
            hprcSegmentsLane(CFHR_REGION),
            {
              trackId: 'hprc_minigraph_alleles',
              type: 'LinearAlignmentsDisplay',
              // the coverage row plus the three rows this window packs into; the
              // display's default leaves most of its box empty here
              height: 115,
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 120000,
    settleMs: 5000,
    viewportWidth: 1000,
    viewportHeight: 515,
    hideTooltip: true,
  },
  // What Settings -> Graph context buys. A region query on the reference reaches
  // a detour's entry and exit segments and nothing behind them, because the
  // interior sits on the donor's own stable sequence, which no reference
  // coordinate names. Those arrive as stubs hanging off the thread and read as
  // small insertions rather than as the one event they are.
  //
  // The paa island rather than an HPRC window, because the point has to be
  // visible in one look. Walking the hosted links index the way getSubgraph
  // does: this window reaches 14 segments at context 0 and 22 at 1 hop, so
  // every added node is a detour interior and the stubs close into bubbles. The
  // same walk over the amylase window gains 15 of 78, which is the same
  // operation on a drawing already dense enough that the reader cannot see it
  // happen (rendered both ways, and the two FMMM layouts are simply different
  // tangles).
  //
  ...graphContextPartSpecs(),
  {
    mode: 'compose',
    name: 'pangenome/graph_context',
    parts: ['pangenome/graph_context_none', 'pangenome/graph_context_hop1'],
    direction: 'horizontal',
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
  // An EXPANSION, deliberately: it is the KIV-2 copy number that Lp(a) turns on.
  //
  // The force drawing, not sample rows, on review. In sample rows the 33 segments
  // came out as a reference lane with eleven stubs hanging off it on grey threads,
  // and the one red arc over it read as a loop drawn on a track: "unclear what the
  // red loop is 'showing'", "please default to showing the bandage graphs over
  // linear backbone in almost all cases. i just dont get it." Drawn as a graph,
  // the same 33 segments are a chain of bubbles, and the arc is one route through
  // one of them. Which haplotypes carry what is what the bubbles lane above states
  // (584 recorded paths), and hprc_graph_vs_callset is the figure whose subject is
  // per-haplotype carriage.
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
              // pinned, not grown: a bubble's label is two lines and the lane
              // packs few enough rows to fit them, so growing it only adds
              // whitespace under the last one
              height: 80,
            },
            hprcSegmentsLane(LPA_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: LPA_REGION,
          layoutMode: 'force',
          colorScheme: 'reference-position',
        },
      ],
    }),
    // the force drawing has no row labels to wait on
    readySelector: TOOLBAR_READY,
    readyTimeout: 180000,
    settleMs: 6000,
    viewportWidth: 1000,
    // the linear stack plus the graph pane, which the force drawing fills rather
    // than leaving flat (990 for the eleven sample rows this replaces); measured
    // against the run's own below-the-fold report, which caught 75px cut at 1090
    viewportHeight: 1170,
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
  // THE CORRESPONDENCE IS AN EVENT, NOT A ROW, and two rounds of review went on
  // trying to make it a row. The graph pane was in sample rows so its rows could
  // be read against the callset's, and `MHC_CALLSET_LAYOUT` cut the callset to
  // the ten donors the graph draws so the two lists would be the same length.
  // They still cannot line up, and the data says why: rGFA's SN names the
  // assembly that FIRST CONTRIBUTED a segment, while a genotype names every
  // haplotype that CARRIES it. Checked at the marked deletion — the graph
  // attributes HG04157's only contribution here to HG04157.2, and the callset
  // has HG04157 carrying that deletion on its FIRST haplotype; HG01993 goes the
  // other way. Relabelling the callset rows into PanSN would therefore have
  // asserted a mapping that is not true, which is the trap avoided here.
  //
  // So the figure marks one EVENT instead: `highlight` puts a band on the 14,596
  // bp deletion at chr6:32,514,842, which crosses the gene lane, the segments
  // lane and the genotype matrix in one column — 6 of the 10 donors carry it,
  // on 9 of their 20 haplotypes. The graph below is the force drawing (review:
  // "consider using force directed bandage graph"), where the same event is a
  // bubble rather than a row. What the pair says: the callset names who carries
  // it, the graph names what the alternative sequence is.
  //
  // MHC_CALLSET_LAYOUT stays, for the reason it was added — 464 rows buries the
  // ten donors this window has anything to say about. Fixed list rather than
  // `runClustering`: clustering is free to reorder and to include any of the
  // 464, so nothing would hold the row set still.
  {
    mode: 'url',
    name: 'pangenome/hprc_graph_vs_callset',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,510,000-32,600,000',
          highlight: [MHC_MARKED_DELETION],
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
          colorScheme: 'reference-position',
        },
      ],
    }),
    // two signals, ANDed: the graph drawn, and the callset's own fetch finished
    // (not just first paint). A bare comma list would be a CSS OR and fire on
    // whichever landed first.
    readySelector:
      'body:has([data-testid="graph-perf-stats"]):has([data-testid="graph-layout-select"]) [data-testid="variant-display-done"][data-display-phase="ready"]',
    readyTimeout: 360000,
    settleMs: 5000,
    viewportWidth: 1000,
    // the gene lane, the segments lane, the 20-row callset, and the graph pane
    // under them — the force drawing is about as tall as it is wide where the
    // row stack was flat
    viewportHeight: 1340,
    hideTooltip: true,
  },
  // The correspondence, which is the reason to open the two views together:
  // hovering a node in the graph highlights the reference interval it occupies
  // in every linear view connected to it.
  //
  // ONE FRAME, ONE DIRECTION. This was a two-stage stack carrying both
  // directions, and it drew "it is hard to tell what is going on in this
  // screenshot, please make it a single panel" — four panels of the same window
  // is too much to hold at once, and the reverse direction was the weaker half
  // anyway: hovering a gene brightens a backbone segment that already spans the
  // frame, so the picture barely changes and the reader is left comparing two
  // near-identical graphs. Graph to linear ends in a band drawn from real
  // coordinates (`getHighlightCoords`), which is a visible thing appearing in a
  // place it wasn't. The reverse direction stays in the guide's prose, where it
  // costs a sentence.
  //
  // A hover figure has no cursor in it, so the frame rings its target: without
  // that the reader sees a band appear with nothing saying what caused it.
  //
  // The force-directed drawing, per review ("the linear backbone is not a good
  // layout"). Sample rows drew this cut as a reference lane with four stubs
  // hanging off grey threads — it says which strain contributed each allele and
  // nothing about how they join; the same 20 nodes as a graph are a chain of
  // bubbles. The hover target survived the switch because it is named rather
  // than measured: `graphNode: 's2037'` (CFT073's 65 kb allele) resolves through
  // the view's own nodePositions, so the layout can move it.
  {
    mode: 'url',
    name: 'pangenome/rgfa_hover_sync',
    url: ecoliHoverSession(),
    // Readiness is the layout having drawn; the highlight cannot exist yet,
    // because it is the hover below that creates it. Asserting it as an action
    // instead is what makes a missed hover fail the spec rather than quietly
    // committing a figure with nothing highlighted.
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the graph pane sizes itself to its drawing, and a force drawing is about
    // as tall as it is wide where the row stack was flat — 600px of pane under
    // the linear view rather than 260
    viewportHeight: 1090,
    // The graph's own hover tooltip stays: it names the node and gives the
    // coordinates on the assembly that contributed it, which is the other half
    // of the correspondence the band shows. spec.hideTooltip does not reach it;
    // that only hides core's BaseTooltip.
    actions: [
      { type: 'delay', ms: 3000 },
      { type: 'hover', anchor: { view: 1, graphNode: HOVERED_ALLELE } },
      {
        type: 'waitForSelector',
        selector: '[data-testid="graph-node-highlight"]',
      },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { view: 1, graphNode: HOVERED_ALLELE },
        radius: 22,
      },
    ],
  },

  // The other half of the way out, on the graph where the contributing
  // assemblies are NOT loadable: right-clicking one haplotype's allele. Its own
  // coordinate is exact and unopenable (no session loads 464 haplotypes as
  // assemblies), so what the menu offers is the GRCh38 interval the allele
  // attaches to, which is the answer the HPRC tutorial's round trip needs.
  //
  // One frame holding both the menu and its result. Review: "need to be able to
  // just highlight lineargenomeview coords", then "make into a single
  // screenshot instead of two screenshots potentially where highlight and right
  // click menu is visible". Hovering a node already draws a band in the linear
  // view, but a hover band lives as long as the pointer does; **Highlight in
  // hg38** writes the same interval into the view's own highlight list, where it
  // stays. That persistence is what lets one frame carry both: the actions click
  // the item, then right-click the same node again, so the menu is open over a
  // band it already left behind. Two stacked frames paid for the whole app
  // chrome twice to say that.
  //
  // The force-directed drawing, per review ("please change to force directed
  // bandage graph"). The right-clicked node is NAMED rather than measured
  // (`anchor: { graphNode }`, resolved through the view's own nodePositions), so
  // the layout, the pane size and the tracks above the graph can all move
  // without silently pointing the click at empty canvas. An anchor that resolves
  // to nothing throws, and the waitForText below fails the capture rather than
  // committing a figure of an unopened menu.
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
              // compact, as in the other HPRC figures: two HLA-DRB genes do not
              // need a lane of their own, and every px here is one the graph
              // rows under it do not get
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 60,
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
    settleMs: 3000,
    viewportWidth: 1000,
    viewportHeight: 1100,
    actions: [
      // the auto-fit has to have finished before the anchor means anything
      { type: 'delay', ms: 2000 },
      { type: 'rightclick', anchor: { view: 1, graphNode: HPRC_ALLELE } },
      { type: 'waitForText', text: 'Highlight in hg38' },
      { type: 'click', text: 'Highlight in hg38' },
      // the band is written into the view's highlight list, and the menu closes
      { type: 'delay', ms: 1500 },
      // the same node again, so the frame carries the menu and the band it left
      { type: 'rightclick', anchor: { view: 1, graphNode: HPRC_ALLELE } },
      { type: 'waitForText', text: 'Node details' },
      { type: 'delay', ms: 500 },
    ],
    // The item that produced the band, boxed. Without it the frame holds a menu
    // and a highlight with nothing joining them, and which of three items did it
    // is a guess — the same complaint the launch figures drew in review. The ring
    // says which node: a context menu opens AT the cursor, so it covers the thing
    // it was opened on, and in a force drawing there is no row label to fall back
    // on.
    annotations: [
      {
        type: 'circle',
        anchor: { view: 1, graphNode: HPRC_ALLELE },
        radius: 22,
      },
      { type: 'box', anchor: { text: 'Highlight in hg38' } },
    ],
  },

  // The way back out of the graph, on the one fixture where it can do more than
  // return to the reference: all five strains loaded as assemblies, so the graph
  // offers a linear view of each contributing strain at its own coordinates, and
  // a synteny view of all of them at once.
  //
  // Two frames, because the menu on its own only shows that the offer exists
  // (reviewer: "a two part screenshot showing the next stage ... could be
  // useful"). This figure takes the synteny entry — the one that makes the whole
  // claim at once: five panels, each already at that strain's own locus, from the
  // segments' SN/SO tags with nothing looked up in an alignment first. The
  // per-strain linear entry is the same menu one row up and gets its own figure
  // (rgfa_strain_launch), so neither frame here has to serve two routes.
  //
  // The clicked rows are boxed and the second frame drops the graph pane, both
  // straight out of review: a cascade with nothing marked is a picture of a menu,
  // and a result frame that still carries the view it was launched from spends
  // half its height restating the frame above.
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
          { type: 'waitForText', text: 'Linear synteny view' },
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
          // The two items this figure's own actions click, boxed, because a
          // cascade screenshot with nothing marked on it is a picture of a menu
          // rather than of a workflow (review: "we need the things being clicked
          // in menus to have red boxes around them"). Anchored by the item text,
          // so a box cannot end up on a row the actions do not take.
          { type: 'box', anchor: { text: 'Launch view' } },
          { type: 'box', anchor: { text: 'Linear synteny view' } },
        ],
      },
      {
        // Re-opened from scratch rather than clicked out of the cascade stage
        // one left standing: the frames differ in height, and the resize that
        // buys frame one its tight crop lands between the two stages and moves
        // the menu under it — the synteny row was then clicked at its old
        // position and nothing launched.
        closeMenusFirst: true,
        // The launched synteny view alone, so the frame is the result rather
        // than 430px of the graph that produced it plus the result (review: "in
        // the second frame we might just want the graphgenomeview panel to be
        // closed"). Frame one is where the graph and its menu are seen. 940 held
        // the graph and the synteny view together; five panels on their own want
        // this much, and at 560 the last one was cut, at 700 there were 107px of
        // blank under them.
        viewportHeight: 600,
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
          // and now the graph pane goes, leaving the five-panel synteny view.
          // Closed after the launch rather than before it: the menu item lives
          // on the graph view, so it has to be there to be clicked.
          {
            type: 'click',
            selector: `${LAUNCH_OUT_VIEW} [data-testid="close_view"]`,
          },
          { type: 'delay', ms: 3000 },
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
  // Two frames, because the review this was rebuilt for could not see a workflow
  // in the one: "i dont see the workflow here. menu items that are clicked need
  // to be shown and boxed in red." The single frame was the graph and its result
  // side by side with the menu already dismissed, so the step between them was
  // the one thing missing. Frame one is now the cascade with the two rows the
  // actions take boxed, frame two the view they open.
  //
  // The K12 linear view the old figure carried on top went with it: three views
  // in one frame at 925px left the launched panel a strip, and the graph's own
  // title states the K12 window the subgraph was cut from. The launched panel
  // carries CFT073's gene track because the launch brings the session's
  // annotation for the assembly it opens on; before that it opened on `No tracks
  // active` and this figure could not have existed.
  {
    mode: 'url',
    name: 'pangenome/rgfa_strain_launch',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      views: [
        {
          // pinned so the menu click scopes to the graph rather than to the view
          // the launch adds below it
          id: 'pks_graph',
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: PKS_REGION,
          // one row per strain, which is what makes the 58.6 kb CFT073 row the
          // thing a reader clicks: the force default draws the same segment as a
          // long arm with no strain to attribute it to
          layoutMode: 'samplerows',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: '[data-testid="graph-row-label"]',
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    // covers the taller second frame (the graph plus the launched panel, whose
    // gene track runs two rows deep at this width); the menu frame sets its own
    viewportHeight: 730,
    hideTooltip: true,
    stages: [
      {
        // The graph pane plus the cascade hanging off its menu. This is also the
        // height stage two ACTS at (a stage resizes after its own actions), and
        // 340 -- which would have trimmed the ~99px of blank this leaves under
        // the cascade -- made the "CFT073 chr:" click launch nothing at all, the
        // same floor rgfa_launch_out_menu measured at ~430. Treat it as measured
        // rather than tidy.
        viewportHeight: 430,
        actions: [
          {
            type: 'click',
            selector: `${PKS_VIEW} [data-testid="view_menu_icon"]`,
          },
          { type: 'click', text: 'Launch view' },
          // expand the per-strain list rather than leaving it a closed submenu
          // row: which strains the graph can open, and at which of their own
          // coordinates, is half of what the menu says here
          { type: 'hover', text: 'Linear genome view' },
          { type: 'waitForText', text: 'CFT073 chr:' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'box',
            anchor: {
              selector: `${PKS_VIEW} [data-testid="view_menu_icon"]`,
            },
          },
          // the three rows the click path takes, in order
          { type: 'box', anchor: { text: 'Launch view' } },
          { type: 'box', anchor: { text: 'Linear genome view' } },
          { type: 'box', anchor: { text: 'CFT073 chr:' } },
        ],
      },
      {
        // Re-opened from scratch rather than clicked out of the cascade stage one
        // left standing: the resize that buys frame one its tight crop lands
        // between the two stages and moves the menu under it, so the strain row
        // would be clicked at its old position. Same reason as
        // rgfa_launch_out_menu.
        closeMenusFirst: true,
        viewportHeight: 730,
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
          // opened empty — which is exactly what this figure exists to show it
          // does not do any more. clbK is 6.5 kb, the widest of them, so its
          // label is the first to render.
          {
            type: 'waitForSelector',
            selector: '[data-testid="feature-name-clbK"]',
            timeout: 120000,
          },
          { type: 'delay', ms: 2000 },
        ],
      },
    ],
  },
]
