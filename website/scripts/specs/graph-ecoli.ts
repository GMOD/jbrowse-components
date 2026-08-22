// The E. coli pangenome figures: the four-strain minigraph rGFA graph and the
// pggb graph built from the same five assemblies, for the pangenome_ecoli and
// multiway_synteny tutorials.
//
// The human half of what used to be one specs/graph.ts is specs/graph-hprc.ts,
// and the two share only what specs/graph-fixtures.ts holds.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { ECOLI_DEMO_BASE } from './demoBase.ts'
import {
  ALT_ALLELE_COLOR,
  CARRIAGE_DISPLAY,
  GRAPH_DRAWN,
  TOOLBAR_READY,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = local('test_data/graphgenomeview/config.json')
// The only fixture loading the graph's contributing strains as assemblies,
// which is what the outbound launch needs: a node can open the strain it came
// from, and the window can open as a synteny view of the strains in it.
const ECOLI_PANGENOME_CONFIG = local(
  'test_data/graphgenomeview/ecoli_pangenome.json',
)
const DATA = ECOLI_DEMO_BASE
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

// The same segments as PGGB_SEGMENTS_SESSION_TRACK, colored by how many
// haplotypes walk each one rather than by reference position. The ramp and its
// legend are CARRIAGE_DISPLAY in graph-fixtures.ts, shared with the
// Minigraph-Cactus figure that draws the same five strains.
const PGGB_CARRIAGE_TRACK = 'ecoli_pggb_carriage'
const PGGB_CARRIAGE_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: PGGB_CARRIAGE_TRACK,
  name: 'pggb graph: segment carriage',
  assemblyNames: ['K12'],
  adapter: {
    type: 'RgfaTabixAdapter',
    uri: `${DATA}/ecoli_pggb`,
  },
}
// The aggregate the lane is read against: `odgi depth` over fixed windows,
// hosted beside the graph indexes. Same question, different unit.
const PGGB_DEPTH_TRACK = 'ecoli_pggb_depth'
const PGGB_DEPTH_SESSION_TRACK = {
  type: 'QuantitativeTrack',
  trackId: PGGB_DEPTH_TRACK,
  name: 'pggb graph: pangenome depth (paths over K12)',
  assemblyNames: ['K12'],
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: { uri: `${DATA}/ecoli_pggb_depth.bw` },
  },
}

// An IS5 element K12 carries and the other four strains do not (review of the
// old window: "unfortunately not interesting screenshot. need structural
// variant"). That window was the colanic-acid cluster, picked for link density —
// 175 link endpoints in 3 kb — but density is not structure: pggb cuts a segment
// at every SNP, so a busy window is a long chain of ~17 bp nodes and the drawing
// is a thread.
//
// This one is a bubble, and it was read off the graph rather than found by eye.
// Segments carried by K12 alone, long enough to be an event rather than an
// allele, with an all-five segment on each side:
//
//   zcat ecoli_pggb.segs.bed.gz | awk -F'\t' '$1 ~ /^K12/' | sort -k2,2n
//
// puts K12 chr:1,299,498-1,300,697 (1,199 bp) in that list, and the links file
// has both arms explicitly: 79945+ -> 79946+ -> 79947+ is K12 through the
// element, 79945+ -> 79947+ is the edge the other four take past it. The K12
// GFF names it — `mobile_element_type=insertion sequence:IS5`, carrying the
// insH21 transposase, so the gene lane labels the arm.
const PGGB_LOCUS = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1299300,
  end: 1300900,
}
const PGGB_LOCUS_WINDOW = 'chr:1,299,300-1,300,900'

// 100 kb of the same graph, centred on the same insertion. The window the fine
// index can draw is the 1.6 kb above; this one is 60x it, and is drawable only
// because the track below draws one node per BUBBLE.
const PGGB_TIER_WINDOW = 'chr:1,250,000-1,350,000'
const PGGB_TIER_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1250000,
  end: 1350000,
}
const PGGB_TIER_TRACK = 'ecoli_pggb_tier50'

// The coarse level-of-detail tier of the pggb graph: one node per bubble, with
// the invariant reference between bubbles as backbone. Same two files and same
// adapter as the fine tier, so nothing in the view, the glyphs or the renderer
// knows the difference -- a collapsed bubble is a reference span with an id and
// a rank, which is the whole segs/links contract.
//
// It exists because `gfatools bubble` returns NOTHING on a pggb GFA (it reads
// rGFA SN/SO/SR to place a bubble on a reference), which left the graph that
// most needs coarsening as the one that could not be coarsened. The
// decomposition this is built from is the one the graph already ships:
// `scripts/snarls_to_bubble_bed.py` turns the hosted `vg deconstruct` snarl VCF
// into the bubble BED `bubbles_to_tier_bed.py` reads, and `build_bubble_tier.sh`
// does the rest. Measured: 143,964 top-level snarls over the whole 4.64 Mb
// graph, 544 of them at `--min-content 50`, so the ENTIRE pangenome is 1,088
// nodes in 51 kB against 606k segments in the fine index.
//
// 50 rather than the HPRC tier's 10,000, and the threshold is what the figure
// turns on: at 0 every SNP is its own node (462 bubbles in 20 kb, which is worse
// than the fine tier), and at 1,000 the 1.2 kb insertion this locus is about is
// the only thing left in 50 kb. 50 keeps every indel and absorbs the
// single-base alternatives into backbone, which is the cut a reader wants.
const PGGB_TIER_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: PGGB_TIER_TRACK,
  name: 'pggb graph bubbles (coarse tier, one node per bubble)',
  assemblyNames: ['K12'],
  adapter: {
    type: 'RgfaTabixAdapter',
    uri: `${DATA}/ecoli_pggb.tier50`,
  },
}

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
// CFT073's allele at PATHS_WINDOW's bubble — 65,410 bp, the longest thing in
// the cut and the one worth hovering. Named rather than measured: the hover and
// the ring drawn over it both resolve it through the view's own nodePositions
// (`anchor: { graphNode }`), so neither goes stale when the layout, the pane
// size or the tracks above the graph move. `node scripts/probe-graph-nodes.ts
// pangenome/rgfa_hover_sync` prints the ids a cut contains.
const HOVERED_ALLELE = 's2037'

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
// EXACTLY what the right-click launch cuts, which is the segment's own span
// padded by half its length either side (subgraphRegionFromFeature): s1277 is
// 4,056,624-4,063,560, so the cut is 4,053,156-4,067,028. It was a round 12 kb
// before, picked to make the label a comfortable right-click target, and it
// still is — but stating the launch's own region here is what lets the two
// frames share a colour ramp, since the graph's ramp runs over `loadedRegion`
// and the lane's jexl runs over these same numbers. A window that merely
// contained the region gave the same segment two different hues in the two
// frames, which is the correspondence review asked for and could not get.
const SEGMENT_LAUNCH_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 4053156,
  end: 4067028,
}
const SEGMENT_WINDOW = 'chr:4,053,156-4,067,028'

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

// THE TWO ISLANDS THEMSELVES, which is a different span from the one above and
// the one the synteny figure is about (review, on rgfa_paa_bubble: "we are
// relying on textbox to tell the whole story, ideally the data viz tells the
// story"). s502 is 21.8 kb of graph segment INSIDE K12's island; the island is
// the whole run with no partner block, and each strain has one.
//
// Both come from the alignment rather than from the picture: Sakai's chain to
// K12 ends at K12 1,419,704 and resumes at 1,474,096, and Sakai's own bounds
// are those two carried through its two offsets (+501,157 on the left block,
// +515,969 on the right — see PAA_SYNTENY_WINDOW). So K12 holds 54,392 bp
// nothing in Sakai matches and Sakai holds 69,204 bp nothing in K12 does, which
// is why the band between them is blank in both directions.
//
// Shaded in their own rows and NAMED, so the frame states the substitution
// without a callout: two marked blocks, no ribbon between them, each labelled
// with what it carries. A shade is what the app can draw over its own
// coordinates, and it moves with the layout where a pill does not.
const PAA_K12_ISLAND_HIGHLIGHT = {
  refName: 'chr',
  start: 1419704,
  end: 1474096,
  label: 'K-12 island: paa operon',
  color: 'rgba(214,137,16,0.13)',
}
const PAA_SAKAI_ISLAND_HIGHLIGHT = {
  refName: 'chr',
  start: 1920861,
  end: 1990065,
  label: 'Sakai island: nleG effectors',
  color: 'rgba(214,137,16,0.13)',
}

// The same span as a locstring, for a linear view placed over one of these cuts:
// the window has to be the cut's own region, or the lane's ramp and the graph's
// run over different spans and the shared hue stops meaning anything.
const PAA_WINDOW = `chr:${PAA_RAMP_DOMAIN.start}-${PAA_RAMP_DOMAIN.end}`

// The synteny rows above the graph. The two partner windows are K12's window
// carried across each strain's own alignment to K12 in ecoli_pggb_ava
// (`tabix ecoli_pggb_ava.pif.gz 'tK12#1#chr:1430000-1490000'`):
//
//     NCTC86  K12 1,434,958-1,632,337 <-> NCTC86 1,698,328-1,898,776
//     Sakai   K12 1,474,100-1,632,416 <-> Sakai  1,990,000-2,158,448
//
// which is the whole argument in two rows of a file: NCTC86's block starts left
// of the island and runs straight through it, and Sakai has no block over the
// island at all — its nearest one starts 6 kb past the island's right edge.
// Each partner window is that block's own scale applied to K12's, so the three
// rows cover the same sequence and the ribbons run level.
//
// 145 kb, and each widening has been for the same reason: a gap needs FLANKS on
// both sides or it reads as a row with no data. At 50 kb Sakai's block arrived
// in the last 4% of the row. At 100 kb (chr:1,420,000-1,520,000) it was half the
// row — but the window opened 250 bp after Sakai's LEFT block ended, so the left
// half was still white with nothing to say why, which is what review saw next
// ("very little synteny between k12 and sakai, only visible on right side of
// screen. might need to zoom out to see more?").
//
// Where the blocks actually end, off the index rather than by eye
// (`tabix ecoli_pggb_ava.pif.gz 'qK12#1#chr:1330000-1560000'`, K12 coordinates):
//
//     NCTC86  ...-1,412,016   1,435,000-...     rejoins 11 kb left of the island
//     Sakai   ...-1,419,704   1,474,096-...     rejoins 6 kb past its right edge
//     CFT073  ...-1,412,240   1,477,560-...
//     IAI39   ...-1,412,032   1,533,072-...
//
// So 1,400,000 puts every left flank in frame and 1,545,000 every right one, and
// the figure's three rows read as one shared break at ~1,412,000 that NCTC86
// closes immediately and Sakai only after the island.
const PAA_SYNTENY_WINDOW = 'chr:1,400,000-1,545,000'
// K12's window carried onto each partner through its own blocks, so a row
// covers the sequence the row above it does. Each partner's two blocks sit at
// different offsets from K12 — that difference IS the island and what else K12
// carries there — so the left edge comes from the left block and the right edge
// from the right one, and the rows are not the same number of bp:
//
//     NCTC86  left  +286,393 (K12 1,314,480 <-> 1,600,873)  1,400,000 -> 1,686,393
//             right +263,409 (K12 1,435,000 <-> 1,698,409)  1,545,000 -> 1,808,409
//     Sakai   left  +501,157 (K12 1,315,000 <-> 1,816,157)  1,400,000 -> 1,901,157
//             right +515,969 (K12 1,474,096 <-> 1,990,065)  1,545,000 -> 2,060,969
const PAA_NCTC86_WINDOW = 'chr:1,686,000-1,808,500'
const PAA_SAKAI_WINDOW = 'chr:1,901,000-2,061,000'

// One gene lane per strain row, all three the same shape (review: "ideally all
// three lineargenomeviews would have a gene track"). Genes only, compact and
// without descriptions, because three of these plus the segments lane sit over
// two ribbon bands and a full annotation lane is four rows of boxes each.
function strainGeneLane(trackId: string) {
  return {
    trackId,
    type: 'LinearBasicDisplay',
    showOnlyGenes: true,
    displayMode: 'compact',
    // was `showDescriptions: false`, which has no home on the unified labels
    // enum — migrateBasicConfigSnapshot resolves it to 'auto', so descriptions
    // do come back at low density. Written as what it actually resolved to;
    // pinning 'name' would honor the original intent but change the figure.
    showLabels: 'auto',
    height: 60,
  }
}

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
    sessionTracks: [
      K12_GENES_SESSION_TRACK,
      ECOLI_SEGMENTS_SESSION_TRACK,
      PGGB_MAF_SESSION_TRACK,
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: PATHS_WINDOW,
        tracks: [
          { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
          // THE ALIGNMENT, BESIDE THE GRAPH'S ANSWER (reviewer: "add maf track
          // if it helps clarify this figure"). The band the hover draws says
          // the graph attaches 65.4 kb of CFT073 across 2.1 kb of K12; a
          // whole-genome alignment of the same five strains says the same
          // event base by base, as CFT073's row dropping out over exactly that
          // interval. It is pggb's MAF rather than minigraph's own output —
          // this figure is on the rGFA graph, but the alignment is between the
          // strains and is the same regardless of which graph is drawn.
          //
          // Same five rows in the same order as the other E. coli figures'
          // lanes (PGGB_STRAIN_ROWS), so a strain sits in the same place on
          // every page.
          {
            trackId: PGGB_MAF_TRACK,
            type: 'LinearMafDisplay',
            layout: PGGB_STRAIN_ROWS,
            height: 130,
          },
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

// The pggb pair: the same track drawn as a graph and as per-strain rows. Each
// takes its own window, a kilobase being the right scale for the whole-locus
// drawing and far too dense for per-strain rows (see PGGB_ROWS_LOCUS).
// The strain order the graph's sample-row layout puts its rows in, which the
// MAF lane above it is pinned to so the two stacks are read as one (review: "if
// there was a maf track of the different samples we could highlight rows in the
// maf and the graphgenomeview"). Cross-highlighting between the two is not
// something either display does; what IS available is the same five rows in the
// same order, one showing the aligned bases and one showing the segments each
// strain takes, so a row can be read straight down. `layout` costs the MAF's
// dendrogram, which at five strains carried nothing the row labels do not, and
// the graph has no tree to agree with anyway.
const PGGB_STRAIN_ROWS = ['K12', 'CFT073', 'IAI39', 'NCTC86', 'Sakai'].map(
  name => ({ name }),
)

// pggb's own `-M` MAF, as a session track: the shared graphgenomeview fixture
// config carries the K12 assembly and nothing else, so every track in these
// figures is declared here against the hosted demo's files. Absolute urls, not
// the hosted config's relative ones — a session track's relative `uri` resolves
// against the RPC worker's own url.
const PGGB_MAF_TRACK = 'ecoli_pggb_maf'
const PGGB_MAF_SESSION_TRACK = {
  type: 'MafTrack',
  trackId: PGGB_MAF_TRACK,
  name: 'pggb graph: whole-genome alignment (MAF, vs K12)',
  assemblyNames: ['K12'],
  adapter: {
    type: 'MafTabixAdapter',
    samples: ['K12', 'Sakai', 'CFT073', 'NCTC86', 'IAI39'],
    uri: `${DATA}/ecoli_pggb.maf.bed.gz`,
  },
}

// The same graph read as a callset: `pggb -V K12:...` runs `vg deconstruct` over
// the smoothed graph, so every bubble becomes a record on the K12 axis. It is
// the one lane in this set that can state an alternate route the reference has
// no coordinate for, because a record's ADDRESS is the span the route replaces.
const PGGB_VARIANTS_TRACK = 'ecoli_pggb_variants'
const PGGB_VARIANTS_SESSION_TRACK = {
  type: 'VariantTrack',
  trackId: PGGB_VARIANTS_TRACK,
  name: 'pggb graph: variants (vg deconstruct, vs K12)',
  assemblyNames: ['K12'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: `${DATA}/ecoli_pggb.vcf.gz`,
  },
}

// The positional-variant track and the two structural-filter spellings that
// used to live here went with `pangenome/pggb_spur_linear`, which was their only
// consumer. Worth knowing if a variant lane comes back to this file: the two
// spellings were NOT interchangeable. The matrix display's `jexlFilters` is a
// model property feeding a SerializableFilterChain and needs the `jexl:` prefix
// written out, while the canvas LinearVariantDisplay's slot adds the prefix
// itself and a doubled one is a parse error -- which does not throw, it sits in
// `loading` forever and reads as a slow fetch. The same VCF under a second
// trackId was also deliberate, since a session spec naming one track twice keeps
// only the LAST display.

// `mafLane` is stated rather than derived from `layoutMode`, because the two
// halves of pangenome/pggb_locus_sample_rows differ ONLY in layoutMode: a lane
// that appeared over one half and not the other would be a second difference
// the pair does not mean, and the MAF rows are exactly what the force half has
// to be read against.
function pggbLocusSession(
  layoutMode: 'force' | 'samplerows',
  {
    region,
    window,
    mafLane = false,
    variantLane = false,
    bubbleSpread,
  }: {
    region: typeof PGGB_LOCUS
    window: string
    mafLane?: boolean
    variantLane?: boolean
    // omitted leaves the view's own 'auto' (proportional) default; see
    // BUBBLE_SPREADS in the plugin for what each one is an instrument for
    bubbleSpread?: 'auto' | 'open' | 'wide' | 'compress'
  },
) {
  return sessionSpec(CONFIG, {
    sessionTracks: [
      K12_GENES_SESSION_TRACK,
      PGGB_SEGMENTS_SESSION_TRACK,
      ...(mafLane ? [PGGB_MAF_SESSION_TRACK] : []),
      ...(variantLane ? [PGGB_VARIANTS_SESSION_TRACK] : []),
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: window,
        tracks: [
          { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
          // The graph's own alternate routes as records on the K12 axis, which
          // is where a spur that has no reference coordinate of its own DOES
          // get one: `vg deconstruct` states it as the reference span it
          // replaces. One row per strain, so which strain takes the detour is
          // in the lane rather than only in the drawer.
          ...(variantLane
            ? [
                {
                  trackId: PGGB_VARIANTS_TRACK,
                  type: 'LinearMultiSampleVariantDisplay',
                  height: 110,
                },
              ]
            : []),
          ...(mafLane
            ? [
                {
                  trackId: PGGB_MAF_TRACK,
                  type: 'LinearMafDisplay',
                  layout: PGGB_STRAIN_ROWS,
                  showTree: true,
                  height: 150,
                },
              ]
            : []),
          {
            trackId: PGGB_SEGMENTS_TRACK,
            type: 'LinearBasicDisplay',
            // labels off: at this density they are hundreds of overlapping
            // integer ids, and the lane is here for the color sweep
            showLabels: 'none',
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
        ...(bubbleSpread ? { bubbleSpread } : {}),
      },
    ],
  })
}

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
//
// Both halves box THE SAME TWO NODES and say which setting they are (review: "I
// don't particularly understand the difference here. ideally, shows red boxes
// and arrow and/or text annotation showing the difference between the two
// sides"). Without that, the difference is stated only as a node count in a
// header over two FMMM tangles that share no visible landmark, so the reader has
// nothing to compare. Boxed on their ids rather than their positions, so the two
// layouts can put them wherever they like, and one colour per node so the pair
// is legible ACROSS the composite rather than only within a half:
//
// - s2093 (43 bp, blue) and s2095 (558 bp, orange) are where one CFT073 detour
//   leaves the backbone and rejoins it. At None they are the two loose ends. At
//   1 hop the same two boxes are the two sides of a closed bubble.
// - s2094 (5.5 kb) is that detour's interior. It sits on CFT073's own contig, so
//   no K12 coordinate names it and the region query cannot reach it. It is what
//   the hop adds, and the red arrow in that half points at it.
//
// The hop reaches five other segments too, which is why the right half still has
// loose ends: one step out lands on a new frontier (s2092, s2387, s2633), and two
// of the five are rank 0 reference either side of the window (s499, s508).
//
// THE WINDOW DOES NOT WIDEN, and that was measured rather than argued (review:
// "zooming out and showing more graph context could help particularly if this is
// just a localized bubble"). It is what the sibling HPRC figure wanted, but the
// two figures are about different things: amylase is about where the complexity
// sits, so its flanks are the finding, while this one is about one bubble being
// open or closed. Rendered at 60 kb the cut is 28 and 35 nodes, the backbone
// draws as a long chain across the pane, and the two boxed nodes land next to
// each other on it as specks, so the closed bubble the right half exists to show
// stops being visible. 29.5 kb is also already the smallest window that holds
// both boxes: s2093 and s2095 anchor at the two ends of the 21.8 kb island.
function graphContextPartSpecs(): ScreenshotSpec[] {
  const DETOUR_ENTRY = 's2093+'
  const DETOUR_EXIT = 's2095+'
  const DETOUR_INTERIOR = 's2094+'
  // One colour per node, the same colour in both halves, which is what makes the
  // composite readable as one picture: the blue box is s2093 on the left and
  // s2093 on the right, and the reader can see that without reading a caption.
  // All three boxed one red was a figure where the left 43 bp box and the right
  // 43 bp box asserted no relationship (review: "might want to use different
  // colors for the different annotation boxes so it is clear what the
  // correspondence is across the left and right panels"). The interior keeps the
  // callout red because it is the half's one asymmetry rather than a member of
  // the pair, and the label pill is slate so the panel's caption does not read as
  // a third mark of the same kind.
  const ENTRY_COLOR = '#1a56db'
  const EXIT_COLOR = '#e8710a'
  const INTERIOR_COLOR = '#e3242b'
  const LABEL_COLOR = '#37474f'
  // The label sits in the graph pane's own top-right, which is empty in both
  // layouts, anchored on the canvas the graph draws into. NOT on the node-count
  // readout beside it, which was the first thing tried: that element is text, so
  // its width and therefore its centre move with the numbers it happens to be
  // showing. `17 nodes, 21 edges` against `20 nodes, 25 edges` shifted the pill
  // and swung the arrow tail off the pane, which is a callout decalibrated by the
  // thing it is captioning. The canvas is sized by the viewport instead, and its
  // 13px height difference between the halves is the only thing dy inherits.
  //
  // It names the setting and nothing else — one short label per panel, with what
  // the two halves mean in the page's <Figure caption>. maxWidth keeps the pill
  // inside its own half of the composite if a setting name ever grows past the
  // ~260px left of the canvas centre plus dx.
  const canvasAnchor = { selector: '[data-testid="graph-genome-canvas"]' }
  const label = (text: string): Annotation => ({
    type: 'text',
    text,
    anchor: canvasAnchor,
    dx: 110,
    dy: -278,
    maxWidth: 205,
    fontSize: 18,
    color: LABEL_COLOR,
  })
  const part = (
    name: string,
    subgraphContext: number,
    text: string,
  ): ScreenshotSpec => ({
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
              // as in strainGeneLane: the retired `showDescriptions: false`
              // resolved to 'auto'
              showLabels: 'auto',
              height: 60,
            },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              showLabels: 'none',
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
          subgraphContext,
          // review: "the closed bubble is really large which looks odd". It was
          // the 21.8 kb backbone node, which at Bandage's own proportional scale
          // draws 5x the mean and curls into a green ring that took a third of
          // the pane while the 43 bp and 558 bp nodes the figure is about were
          // specks against it. 'open' floors every node at 2.5x the mean drawn
          // length, so the ratio across this cut goes from ~500:1 to ~2:1 and
          // the boxed bubble is the largest thing in the drawing rather than the
          // backbone it hangs off.
          // Bandage's own drawn-length power law, which replaced the 'open'
          // floor here for the same reason pangenome/graph_resolution took it
          // (review, on all three graph figures: "frankly pretty chaotic
          // screenshot"). A floor is per-node, so it lifted the backbone's
          // non-branching chain nodes along with the two the figure boxes, and
          // the drawing spread out until zoom-to-fit was in the 80s; compressed,
          // the same cut fits at ~200%, the 21.8 kb island is an ordinary arc
          // rather than a ring, and the 43 bp detour entrance is a legible lens
          // in the 1 hop half.
          bubbleSpread: 'compress',
          // FMMM's iteration budget: 1 is 15 fixed + 10 fine-tuning, 4 is
          // 120 + 60. Same review round as the sibling graph figures ("are you
          // sure you can't iterate it more times for better layout?"), and it is
          // what takes the crossings out of a drawing this size for milliseconds.
          layoutQuality: 4,
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
    annotations: [
      ...(
        [
          [DETOUR_ENTRY, ENTRY_COLOR],
          [DETOUR_EXIT, EXIT_COLOR],
        ] as const
      ).map(([graphNode, color]): Annotation => ({
        type: 'box',
        anchor: { view: 1, graphNode },
        strokeWidth: 3,
        color,
        // a wash the node's own colour cannot be mistaken for, so the pairing
        // survives being read at thumbnail size, where a 3px outline does not
        fillOpacity: 0.1,
        // clear of the node's own "43 bp" / "558 bp" label, which the graph
        // writes across the node rather than inside its bounding box
        pad: 22,
      })),
      label(text),
      // the arrow only exists in the half that has an interior to point at.
      // A third box would be the honest shape, but the interior draws BETWEEN
      // the two boxed nodes, so a box at pad 22 overlaps both of theirs.
      ...(subgraphContext > 0
        ? [
            {
              type: 'arrow',
              anchor: { view: 1, graphNode: DETOUR_INTERIOR },
              // out of the pill's lower left corner, which is where the label
              // above puts it — the one-line pill's baseline plus its descent
              // and padding
              fromAnchor: { ...canvasAnchor, dx: 150, dy: -262 },
              strokeWidth: 3,
              color: INTERIOR_COLOR,
              // down the interior's own arc, away from the entry node's box: at
              // the node's centre the head sits under that box's lower corner
              // and can be read as pointing at it
              dy: 12,
            } satisfies Annotation,
          ]
        : []),
    ],
  })
  return [
    part('pangenome/graph_context_none', 0, 'Graph context: None'),
    part('pangenome/graph_context_hop1', 1, 'Graph context: 1 hop'),
  ]
}

// pangenome/local_subgraph: the pggb subgraph read from a GFA FILE rather than
// from the tabix index, over a linear view of the same locus, anchored on the
// K12 path.
//
// ANCHORED ONLY, where this was an anchored+force pair (reviewer: "is this a
// dupe of pangenome/local_subgraph in a way?", on pggb_locus_sample_rows).
// Partly yes, and this is the half of it that was: the two figures sit ~100
// lines apart in the E. coli tutorial on the same 460 bp, and their force
// panes drew nearly the same nodes twice (54/70 from the index against 48/63
// from the file). What does not duplicate is this figure's own claim, which
// needs the anchored layout: anchoring on the K12 path makes every node the
// walk reaches rank 0 at that offset, so the strip above and the backbone
// below share an axis as well as the Depth ramp, and the green-to-yellow step
// lands at the same x in both. The force drawing of this locus is one figure
// up, as the right half of pggb_locus_sample_rows, and the tutorial's prose
// about the blunt 93 bp end now points there.
function localSubgraphSpec(): ScreenshotSpec {
  const build = (
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
    // full width now that this is one frame rather than half of a `+append`
    viewportWidth: 1000,
    // sized to its own content: the anchored layout has a pinned aspect ratio —
    // row spacing is a fraction of the reference span — so the pane is two rows
    // whatever the viewport says.
    viewportHeight,
    hideTooltip: true,
    // The blunt end, named in both halves. Review, twice: "why is it blunt? why
    // wouldn't an insertion be a loop?" and then "if needed, add text
    // annotation to say why it is blunt. also, it is not clear the size in the
    // 'backbone' visualizations."
    //
    // Segment 20 is 93 bp of CFT073 (CFT073:1,048,515-1,048,608) and carries
    // exactly one link inside this file. In the WHOLE graph it carries two, and
    // the second one lands 7 kb outside the `odgi extract -r
    // K12#1#chr:1004500-1004900` this figure was cut with -- so the free end is
    // where the cut fell, not a dead end in the graph, and the event it belongs
    // to is a 7 kb deletion whose far anchor went with the cut.
    //
    // "IF WE EXTRACTED MORE DATA, IT WOULD RECOVER POTENTIALLY? I WANT TO NOT
    // HAVE BLUNTED ENDS JUST AS A RESULT OF EXTRACTING TOO SMALL OF A WINDOW"
    // (review). Measured against the hosted graph rather than estimated, and the
    // answer is no. In `ecoli_pggb.segs.bed.gz` this node is segment 176693,
    // rank 1, CFT073 only; `ecoli_pggb.links.bed.gz` gives its two links as
    // 176689 at K12:1,004,686 and 178029 at K12:997,566. So the far anchor is
    // 7.1 kb away on the reference and the window that reaches it is
    // K12:997,566-1,004,961. Extracting it: `-E` over K12:1,000,500-1,008,900 is
    // 6,361 segments and over 997,500-1,011,900 is 6,763, against the 48 here.
    // That is the base-level graph's ~17 bp per segment, not a bad choice of
    // window, and 6,000 nodes in this pane is a thread rather than a drawing.
    // `-c 1` would add the far anchor alone without the 6,000 between, and it is
    // worse: the anchor's own two ends are then blunt, and the anchored layout
    // places it at K12:997,566, which is 7 kb off the left of the linear view
    // this pane is under.
    //
    // The end is therefore an EVENT and the label says so, rather than saying
    // the window was too small and inviting the same question again.
    //
    // Ringed AND labelled in the anchored half too, which is the other half of
    // the note: on the backbone the rank-1 nodes are unlabelled marks under the
    // reference row, so nothing there says how big one is. Anchored by segment
    // id (probe-graph-nodes.ts), so neither layout has to hold still.
    annotations: [
      {
        type: 'circle',
        anchor: { view: 1, graphNode: '20+' },
        radius: 22,
        strokeWidth: 3,
      },
      {
        type: 'text',
        // The sentence goes on the force half, which has the room; the anchored
        // half gets the size alone. Its pane has a pinned aspect ratio -- row
        // spacing is a fraction of the reference span -- so it is two rows tall
        // whatever the viewport is, and a three-line pill anywhere inside it
        // lands on the rows it is annotating (tried: below the ring it fell
        // through the pane's own border into the composite's padding). The size
        // beside the ring is what the note asked that half for anyway.
        // WHY THE NODE HAS A LOOSE END, which is the one thing here a reader
        // cannot get from the frame: every other end in the drawing joins
        // something, and this one stops because the window stops, not because
        // the graph does. It used to read a bare "93 bp" — a specific value, and
        // one the surrounding prose and the caption both already give, so the
        // pill spent its space saying the size a third time.
        //
        // "the cut" was denied as jargon (reviewer: "a person not familiar with
        // graphs might not understand what is meant by 'the cut', use precise
        // language please"), so this says the extracted window instead.
        text: 'one end open: its partner falls outside the extracted window',
        anchor: { view: 1, graphNode: '20+' },
        // -34 put the pill's own row across the backbone's node labels, which
        // the shorter "93 bp" cleared by being narrow rather than by being
        // placed. Raised into the empty band the anchored layout leaves between
        // the toolbar and the chain, which is where a two-line pill fits.
        dy: -72,
        // Narrower than the 330 the old three-line sentence needed, so the pill
        // ends well left of the backbone's own "158 bp" label.
        maxWidth: 260,
        fontSize: 17,
      },
    ],
  })
  return build('pangenome/local_subgraph', 'auto', 640)
}

// The halves of pangenome/graph_resolution: ONE window of K12, cut from the two
// graphs the demo carries. The tutorial argues in prose that a pggb graph runs
// ~17 bp per segment while a minigraph rGFA records only structural variation,
// and that you should therefore browse the rGFA whole-genome and the pggb graph
// a kilobase at a time — and never showed it. This is that argument as a
// picture, and it is the comparison a pangenome reader most wants: same locus,
// same reference, same colors, two graph resolutions.
//
// 300 bp, and the size is the finding rather than a taste call. A force pane is
// legible up to somewhere around 50 nodes and not past it, measured on this very
// cut in one 600 px pane: 3 kb is 521 nodes, zoom-to-fit lands at 6.7% and a node
// occupies ~1.3 px, so the pane draws as a single beaded rope and no bubble in it
// can be seen at any drawn-length law. The same cut at 300 bp is 53 nodes, fits
// at 66%, and every node, label and direction arrow reads. That ceiling is a
// property of the pane, not of this graph — `drawPaths` found the same ~50
// independently — so a denser window cannot be fixed by tuning the layout.
//
// The minigraph half does not move with it: the whole window sits inside the
// 4.4 kb s693, so the one-hop cut returns the same seven segments at 300 bp as
// at 3 kb. What shrinking costs is only pggb's node count, which is the half
// that could not be read.
//
// The colanic-acid cluster, the busiest stretch of this graph in the demo's own
// index: `tabix ecoli_pggb.links.bed.gz 'K12#1#chr:2120000-2123000'` returns 175
// link endpoints on a non-K12 stable sequence, against 24 at the ycbF/pyrD
// window pangenome/local_subgraph uses. Picked for link density rather than by
// eye, so the pggb half is dense because the graph is, not because any window
// looks like that.
const RESOLUTION_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 2120000,
  end: 2120300,
}
// EACH HALF CUTS WHAT ITS OWN GRAPH CAN DRAW, which is the figure's claim and
// was the figure's remaining problem (review: "the teal node just doesnt connect
// to anything which is bad. users will not understand this if this is just a
// jbrowse limitation of our data fetching ... we may want to zoom out even
// more"). On the 300 bp cut the minigraph pane held s693 plus the one-hop
// neighbours either side of it, and the larger of those, the 16.4 kb s694, ran
// off into the pane with a junction at one end and the cut edge at the other. No
// wording fixes that: it is the biggest thing in the drawing and half of it is
// missing. The minigraph half now cuts the three backbone segments whole
// (s692-s694), so s694 is an interior node of a chain with a vertex at each end,
// and the frontier falls on 2-121 bp stubs that read as what they are.
//
// The pggb half stays at 300 bp because 300 bp is what it can draw (above). Two
// cut sizes in one figure IS the finding — the prose under it says browse the
// rGFA whole-genome and open the pggb graph where you want every base — so each
// pane's own cut is banded on the shared lane and the sizes are read off the
// same ruler.
const RESOLUTION_MINIGRAPH_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 2118646,
  end: 2139486,
}
// The lane both halves show: one segment past each end of the wider of the two
// cuts (s689 through s698 in `ecoli_minigraph.segs.bed.gz`), so every node drawn
// in either pane — including the ones the one-hop expansion reaches past the
// band — is a block in the lane above it at the same colour, and no node
// saturates at an end of the ramp for want of coordinates in frame.
const RESOLUTION_LANE_DOMAIN = { start: 2118405, end: 2146600 }
const RESOLUTION_LANE_WINDOW = 'chr:2,118,405-2,146,600'

function graphResolutionPartSpecs(): ScreenshotSpec[] {
  const part = ({
    name,
    trackId,
    sessionTrack,
    label,
    // Where the half's own caption sits, as an offset from the graph canvas
    // centre. Not shared: the minigraph half needs its right side clear for the
    // s693/s694 junction, and the same offset in the pggb half would sit on the
    // braid's top-left arm.
    labelOffset,
    extraAnnotations = [],
    // Shared by both halves now, where each used to need its own. See the
    // GraphGenomeView props below for what changed.
    bubbleSpread = 'compress',
    // 3 (60 + 40 FMMM iterations), and both halves take it — review: "the
    // bandage graph just looks very jagged here". This was pinned at 1 (15 + 10)
    // from before the plugin raised its own default to Bandage's 2, and 25
    // iterations is not enough to straighten a chain: the pggb cut is 53 nodes
    // of which 33 are 1 bp, so the drawing is essentially one long path, and an
    // under-relaxed path keeps the kink at every joint it started with. That IS
    // the jaggedness — not the alt arms, which are the same 18 nodes either way.
    // At 3 the same cut draws as a smooth arc and the beads read as beads.
    //
    // It is not "more is better": on this figure 4 (120 + 60) relaxes the arc
    // into a hockey stick that leaves half the pane empty, and the note against
    // pangenome/rgfa_strain_launch records 4 spreading an 11-node cut off both
    // edges. 3 is where this pair of cuts stops improving. The minigraph half
    // takes it too, unasked, because it was the same under-relaxation: at 1 its
    // 16.4 kb backbone segment ran diagonally across the 4.4 kb one it joins,
    // and at 3 the five backbone segments lie end to end with the stubs hanging
    // off them, which is what the half is for.
    layoutQuality = 3,
    region = RESOLUTION_REGION,
    bandCut = true,
  }: {
    name: string
    trackId: string
    sessionTrack: object
    label: string
    labelOffset: { dx: number; dy: number }
    extraAnnotations?: Annotation[]
    bubbleSpread?: 'auto' | 'open' | 'wide' | 'compress'
    layoutQuality?: number
    region?: typeof RESOLUTION_REGION
    bandCut?: boolean
  }): ScreenshotSpec => ({
    mode: 'url',
    name,
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, sessionTrack],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: RESOLUTION_LANE_WINDOW,
          // The pggb half's 300 bp cut, banded on the ruler so the lane says
          // which sliver of itself that pane is. Not on the minigraph half: its
          // cut is nearly the whole window, and a band over three quarters of a
          // panel reads as a background tint rather than as a mark. The lane is
          // the same span in both halves either way, so the two cuts are still
          // measured against one ruler.
          highlight: bandCut ? [region] : [],
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
            {
              trackId,
              type: 'LinearBasicDisplay',
              // labels off in both halves: the pggb lane is hundreds of bare
              // integer ids at this width, and the halves have to be read the
              // same way for the density difference to be the only difference
              showLabels: 'none',
              heightMode: 'grow',
              color: referencePositionColor(RESOLUTION_LANE_DOMAIN),
              // The pggb lane is ~2,400 segments over this span, which is past
              // the default density gate (1 feature per screen px) and draws the
              // "Too many features" banner instead of the lane — i.e. the one
              // half whose density IS the subject would be the half that refused
              // to draw it. Both halves take the same raised gate so the two
              // lanes are still drawn the same way.
              maxFeatureScreenDensity: 20,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: trackId,
          loadedRegion: region,
          // The ramp runs over the LANE's span, not the cut's, so a node and
          // its block are one colour. On the cut's own span every node reaching
          // past it saturates at an end of the ramp, which is what painted the
          // 16.4 kb backbone neighbour magenta and made it read as a giant
          // off-reference allele.
          colorDomain: RESOLUTION_LANE_DOMAIN,
          // review: "the teal node just doesnt connect to anything". Drawn
          // proportionally s694's 16.4 kb is 5x the mean of this cut and 43x its
          // smallest node, so it swept the whole pane, its junction with s693 sat
          // in a corner and its free end ran through the middle of the frame,
          // which is the reading the note describes. 'compress' is Bandage's own
          // power law, 0.5 and 0.5 against the graph's mean, which brings that
          // 43:1 drawn range to about 3:1.
          //
          // Both halves, which the 'open' floor this figure used to run could not
          // do: a floor is a per-node minimum, so it lifted a cut's non-branching
          // chain nodes along with its alleles and the drawing inflated with the
          // node count (the pggb half went to ~52,000 units and a 1.4% fit).
          // Stated against the mean it leaves the drawing the size it already
          // was, so a 7-node cut spanning 6 bp to 16.4 kb and a 53-node cut
          // averaging ~6 bp can share one setting. The floor is still the right
          // instrument where one long node has to stay long, which is why
          // pangenome/pggb_haplotype_paths keeps it.
          bubbleSpread,
          // FMMM's iteration budget (1 = 15+10 iterations, 4 = 120+60), the same
          // review round's "are you sure you can't iterate it more times".
          layoutQuality,
          // force in both halves. An anchored layout puts a cut on one line and
          // hides exactly what is being shown.
          layoutMode: 'force',
          colorScheme: 'reference-position',
          // Bandage's own node-length floor is sized for assembled contigs, so
          // a pangenome allele of a few bases clamps to a stub and both arms of
          // a bubble land within one node thickness of each other. Without this
          // the pggb half draws as a single 521-node thread with no visible
          // branching, which is the one thing the figure is for.
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    // the pggb cut fetches and lays out two orders of magnitude more nodes
    readyTimeout: 180000,
    allowUnsettled: true,
    settleMs: 8000,
    // half the composed width each
    viewportWidth: 750,
    // The graph pane caps at 600 px and zoom-to-fit works against that box, so
    // an under-tall viewport does not just crop the frame, it makes the fit
    // itself spill: at 900 both halves ran their drawing off the bottom edge.
    viewportHeight: 1060,
    hideTooltip: true,
    annotations: [
      {
        type: 'text',
        text: label,
        anchor: { selector: '[data-testid="graph-genome-canvas"]' },
        ...labelOffset,
        maxWidth: 205,
        fontSize: 18,
      },
      ...extraAnnotations,
    ],
  })
  return [
    part({
      name: 'pangenome/graph_resolution_minigraph',
      // the three backbone segments whole, which is what takes the s694 callout
      // out of this half: see RESOLUTION_MINIGRAPH_REGION
      region: RESOLUTION_MINIGRAPH_REGION,
      bandCut: false,
      trackId: ECOLI_SEGMENTS_TRACK,
      sessionTrack: ECOLI_SEGMENTS_SESSION_TRACK,
      label: 'minigraph rGFA\nstructural variation only',
      labelOffset: { dx: -340, dy: -260 },
    }),
    part({
      name: 'pangenome/graph_resolution_pggb',
      trackId: PGGB_SEGMENTS_TRACK,
      sessionTrack: PGGB_SEGMENTS_SESSION_TRACK,
      label: 'pggb\na node at every variant',
      // inside the arc, which is where this cut leaves its whitespace. Up and
      // right was the empty corner when the same cut drew as a kinked rope; the
      // relaxed arc runs through that corner and under the box.
      labelOffset: { dx: 0, dy: 20 },
    }),
  ]
}

// WHAT THE SUBGRAPH TOUR TYPES INTO THE PASTE BOX, and it is
// `pangenome_ecoli.md`'s own "Browsing the whole graph by locus" fence character
// for character (check-paste-configs). A reader watching the clip is meant to
// recognise the block above it on the page, so the two are one text: change the
// fence and change this in the same commit.
//
// The url is written out rather than taken from DATA, for the same reason: the
// page prints one, and an ECOLI_DEMO_BASE run would type a config the page does
// not carry. It is also why the tour is worth filming at all — this adapter
// reads four files off one prefix, so `Add a track from file or URL` has no
// extension to guess from and pasting the config is the route.
export const PGGB_SEGMENTS_TRACK_JSON = `{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_segments",
  "name": "pggb graph segments (whole graph, by locus)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb"
  },
  "displayDefaults": { "showLabels": "none" }
}`

// The window the subgraph tour opens on, before it narrows to PGGB_LOCUS_WINDOW.
// Wide enough that the narrowing is a visible move and the lane arrives as the
// mat a base-level graph is, narrow enough to stay under maxFeatureScreenDensity
// while the drawer holds ~400 px of the view: this cuts ~750 K12 segments where
// the gate is one per pixel.
const PGGB_TOUR_WINDOW = 'chr:1,290,000-1,310,000'

// What website/scripts/video-specs.ts films. The two pggb tours open the same
// config, the same session tracks and the same loci these figures do, so they
// are shared rather than copied: a tour whose track definition had drifted from
// the figures' would walk a reader through a route into an app the rest of the
// page is not showing, and nothing would report it.
//
// One export rather than nine, because none of these is independently
// interesting outside that file and a module's export list is read as its
// surface.
export const pggbVideoFixtures = {
  config: CONFIG,
  genesTrack: K12_GENES_SESSION_TRACK,
  segmentsTrack: PGGB_SEGMENTS_SESSION_TRACK,
  segmentsTrackId: PGGB_SEGMENTS_TRACK,
  locus: PGGB_LOCUS,
  locusWindow: PGGB_LOCUS_WINDOW,
  tourWindow: PGGB_TOUR_WINDOW,
  rowsLocus: PGGB_ROWS_LOCUS,
  rowsWindow: PGGB_ROWS_WINDOW,
  locusSession: pggbLocusSession,
  // The five-assembly config, which the outbound launch needs and CONFIG cannot
  // serve: the node menu offers only assemblies the session has, so on a
  // K12-only fixture the CFT073 entry the tour clicks is not in the menu at all.
  pangenomeConfig: ECOLI_PANGENOME_CONFIG,
  // The CFT073 allele pangenome/pggb_strain_launch rings, so the tour and the
  // still open the same node's menu.
  strainLaunchNode: '118465-',
}

export const ecoliGraphSpecs: ScreenshotSpec[] = [
  // THE COARSE END OF THE LADDER: the pggb graph drawn one node per bubble
  // instead of one node per segment. This was the answer to the second report
  // on the fine-grained figure that used to sit above it ("the large green loop
  // is small now but figure still has many small bubbles. we may want to look
  // at mechanisms to 'pop' the bubbles similar to pangyplot"), and pangyplot's
  // mechanism is exactly this: decompose once offline, draw the collapsed
  // graph, open one bubble when a reader asks. That fine-grained figure
  // (pggb_locus_graph) has since been deleted -- it never stopped reading as a
  // tangle, and it drew the same IS5 element as pggb_haplotype_paths below.
  //
  // What the collapse does: 100 kb here is **11 bubbles and 12 backbone
  // nodes**, because a `--min-content 50` tier absorbs every single-base bubble
  // into the backbone and keeps every indel. Nothing is hidden that a reader
  // was reading: each surviving node states what it collapsed (`cn` segments,
  // `cw` traversals, `cs`/`cl` shortest and longest allele), and the IS5
  // insertion is `cl:i:1200` here.
  //
  // Anchored rather than force-directed, which is the opposite choice from the
  // fine figure and for the reason the layout note gives: a tier IS a chain
  // (backbone, bubble, backbone, ...), so there is no graph shape for a force
  // layout to find, and an anchored row puts each bubble under its own
  // coordinate in the lane above it.
  //
  // FORCE WAS TRIED AND RENDERED, so don't re-try it (review: "might benefit to
  // see bandage force directed graph view of bubbles. backbone just tends to
  // not look good"). The pane already IS a graph view -- what the note asks for
  // is the other layout, and it turns 27 nodes and 26 edges into a near-vertical
  // thread down one corner of the pane at 64.8% zoom, with the run reporting 413
  // css px of page below the fold and the IS5 callout off-frame. That is the
  // chain argument arriving as a picture: with no branch structure, the force
  // solver has nothing to spread and returns the chain as a line, while the
  // anchored layout spends the same pixels putting each bubble under its own
  // coordinate. The backbone looking plain is the anchoring working.
  {
    mode: 'url',
    name: 'pangenome/pggb_bubble_tier',
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, PGGB_TIER_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PGGB_TIER_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
            {
              trackId: PGGB_TIER_TRACK,
              type: 'LinearBasicDisplay',
              showLabels: 'none',
              height: 50,
              color: referencePositionColor(PGGB_TIER_REGION),
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: PGGB_TIER_TRACK,
          loadedRegion: PGGB_TIER_REGION,
          // 'auto' IS the anchored layout; the enum spells the mode and the
          // menu spells the label (layoutModes.ts). There is no 'anchored'
          // value, and a snapshot naming one is rejected by MST with the view
          // never mounting -- which reads as the tier failing to load.
          layoutMode: 'auto',
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    settleMs: 5000,
    viewportWidth: 1000,
    // 640: the run's own `blank below the last content` said 160 at 800. The
    // anchored drawing is two rank rows and the pane sizes to them.
    viewportHeight: 640,
    hideTooltip: true,
    // WHAT CHARCOAL MEANS *IN A TIER*, which is not what it means anywhere else
    // on this page (review, twice: "im still confused by the black bubbles. are
    // the black bubbles not in the reference path?"). The honest answer is no,
    // they are ON it, and the figure was saying the opposite by inheritance:
    //
    //   $ tabix ecoli_pggb.tier50.segs.bed.gz chr:1290000-1310000
    //   chr 1295416 1299497 bb_chr_1295416 0 ct:Z:backbone
    //   chr 1299497 1300697 79945@1299497  1 ct:Z:bubble cn:i:3 cw:i:2 \
    //                                        cs:i:1 cl:i:1200 cv:i:0
    //
    // The arrowed bubble spans 1,200 bp OF K12's own coordinates, and its
    // longest allele is that same 1,200 bp -- K12 is the strain that carries
    // the element; the other four take the 1 bp allele. `bubbles_to_tier_bed.py`
    // gives every bubble rank 1 and every invariant stretch rank 0, so in a tier
    // rank is `bubble` vs `backbone`, NOT `off-reference` vs `reference`. In the
    // fine index it does mean off-reference, and both indexes are drawn through
    // the same reference-position ramp, so the colour looks like the same claim
    // and is not. The caption said "an allele that is not K12 sequence", which
    // was false for this figure and is fixed with it.
    //
    // So a two-row legend, in the pane's empty top-left corner (the app's own
    // ramp key is top-right). It is the one thing on the image that a reader
    // cannot derive from the image.
    //
    // THE SAME EVENT the fine figure below opens, named on the node that stands
    // for it here, so the two figures are visibly about one locus. The id is the
    // tier's own -- source segment qualified by reference start, which is what
    // snarls_to_bubble_bed.py emits and what `tabix ecoli_pggb.tier50.segs.bed.gz
    // chr:1250000-1350000` prints -- so the callout follows the layout rather
    // than a pixel.
    annotations: [
      {
        type: 'legend',
        // 13 is the minimum the overlay clamps to, and it is what makes a
        // two-row pill fit the 63 css px of blank between the pane's top edge
        // and its Reference row. The other blank band, under Rank 1, is 56 px
        // and holds neither size -- rendered there, the pill covered the row
        // label and the first three bubbles.
        fontSize: 13,
        entries: [
          // the ramp's midpoint over this window, which is the green the
          // backbone nodes are drawn in across the middle of the frame
          {
            label: 'backbone: all five strains agree',
            color: 'hsl(150,70%,50%)',
          },
          {
            label: 'bubble: they differ, on K12 coordinates',
            color: ALT_ALLELE_COLOR,
          },
        ],
        // Top left, above the Reference row and left of the app's own ramp key.
        // A legend always grows DOWN from its anchor (`top = cy`), so a
        // `alignY: 'bottom'` placement would have to subtract the pill's own
        // height (padY*2 + rows*round(fontSize*1.5)) -- and there is not enough
        // room down there anyway; see the fontSize note above.
        anchor: {
          selector: '[data-testid="graph-genome-canvas"]',
          alignX: 'left',
          alignY: 'top',
          dx: 16,
          dy: 6,
        },
      },
      {
        type: 'text',
        // A NAME, which is all a label pointing at a node should be. It used to
        // read "IS5, one node (1.2 kb allele)": the allele size is a specific
        // value, and "one node" is what the arrow already lands on.
        text: 'IS5 element',
        fontSize: 16,
        maxWidth: 220,
        anchor: {
          view: 1,
          graphNode: '79945@1299497',
          alignY: 'bottom',
          dy: 70,
        },
      },
      {
        type: 'arrow',
        strokeWidth: 2,
        fromAnchor: {
          view: 1,
          graphNode: '79945@1299497',
          alignY: 'bottom',
          dy: 66,
        },
        anchor: {
          view: 1,
          graphNode: '79945@1299497',
          alignY: 'bottom',
          dy: 6,
        },
      },
    ],
  },
  // Out of the graph and into the strain that carries the allele — the pggb
  // counterpart of rgfa_strain_launch, and the mirror case.
  //
  // That figure launches an INSERTION: CFT073 carries 58.6 kb at K12's tRNA
  // cluster that the reference lacks. This one launches a DELETION, which is the
  // harder direction to see on a reference axis and the one this window already
  // has. s118465 is 75 bp on CFT073#1#chr:1,048,515, and its two links land on
  // K12 at 997,574 and 1,004,667 (`tabix ecoli_pggb.links.bed.gz`), so CFT073
  // carries 75 bp where K12 carries 7.1 kb. Launching it opens CFT073 at its own
  // coordinates, where that sequence is contiguous and carries its own genes —
  // the graph's claim checked against the donor's assembly rather than restated.
  //
  // Why this is possible at all, since the prose nearby says the opposite about
  // DRAWING: the 7.1 kb span cannot be cut as a graph (a base-level pggb graph
  // is ~17 bp per segment, so that window is thousands of nodes), but the launch
  // cuts nothing — it opens a linear view on the donor's coordinates, and the
  // node it starts from sits in a 460 bp window that draws fine. Of the 61 nodes
  // in this cut, 21 are off-reference and carry a donor coordinate like this one.
  //
  // ONE frame, not the two rgfa_strain_launch uses. That figure has to show the
  // menu because it is the one that documents the mechanism; here the mechanism
  // is already documented and what is new is the result, so the menu is driven
  // and dismissed and the frame is the graph beside what it opened.
  {
    mode: 'url',
    name: 'pangenome/pggb_strain_launch',
    // ECOLI_PANGENOME_CONFIG, not the CONFIG the other pggb figures use: that
    // fixture loads K12 alone, and the launch menu only offers assemblies the
    // session actually has, so the node menu came up with `Open in K12 — around
    // this node` as its only target and nothing to click. This one carries all
    // five, which is also what puts CFT073's genes in the launched view.
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      sessionTracks: [PGGB_SEGMENTS_SESSION_TRACK],
      views: [
        {
          // pinned so the menu clicks scope to the graph rather than to the
          // linear view the launch adds under it
          id: 'pggb_launch_graph',
          type: 'GraphGenomeView',
          loadedTrackId: PGGB_SEGMENTS_TRACK,
          loadedRegion: PGGB_ROWS_LOCUS,
          layoutMode: 'force',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    settleMs: 8000,
    viewportWidth: 1100,
    viewportHeight: 1000,
    hideTooltip: true,
    actions: [
      // right-click the allele itself rather than using the view menu: that is
      // what scopes the launch to ONE segment's donor coordinates instead of the
      // whole window's.
      //
      // The node menu is FLAT — `Node details` then one `Open in <assembly> —
      // <locus>` row per launchable target (graphMenuItems.ts). It is not the
      // `Launch view` submenu the view and track menus carry, so there is no
      // cascade to drive here.
      { type: 'rightclick', anchor: { view: 0, graphNode: '118465-' } },
      { type: 'waitForText', text: 'Open in CFT073' },
      { type: 'click', text: 'Open in CFT073' },
      // gate on the launched view's own gene track drawing, not on a delay: the
      // launch carries the session's annotation for the assembly it opens, and a
      // frame captured before that lands is a figure of an empty browser
      { type: 'waitForText', text: 'CFT073 genes' },
      { type: 'delay', ms: 4000 },
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { view: 0, graphNode: '118465-' },
        radius: 20,
      },
    ],
  },
  // Carriage, which is the one statement a pggb index makes that an rGFA cannot
  // and that NO linear projection on this page can make at all.
  //
  // An alternate allele has no reference coordinate, so nothing flattened onto
  // K12 can say who carries it; the variant and MAF lanes answer "what is here"
  // rather than "who has it". The graph answers it because the walk that built
  // the index recorded every haplotype visiting each segment as an `SM:Z:` tag,
  // and clicking a node puts that in the drawer as `carriedBy`.
  //
  // The node is read off the index, not chosen: over this window
  //   tabix ecoli_pggb.segs.bed.gz 'K12#1#chr:1004500-1004961'
  // s119715 is the longest segment (59 bp) whose carriage is a proper subset —
  // K12, Sakai, NCTC86 and IAI39 but not CFT073 — which is the same fact the
  // surrounding prose states from the other side, that CFT073's path covers only
  // the last 293 bp of this window. Longer segments here (s119733, 158 bp) are
  // carried by all five and would show a full house, which says nothing.
  //
  // Needs the plugin bundle pinned in the fixture to be bfe47428e7ae or later.
  // Before that the tag was parsed and dropped: `carriedBy` was empty on every
  // node of every INDEXED graph, because node.samples was only ever populated by
  // the in-app P/W walk a file-loaded graph gets. Measured over this same window
  // at the time: 0 of 53 nodes carried samples, against 53 of 53 after.
  //
  // NO MAF or variant lane in this frame, and the review that asked for one
  // ("may benefit from showing maf track here also, so we see the detour. if
  // other figure already shows this, deduplicate") answered itself with its
  // second sentence. `pangenome/pggb_strain_launch` already draws that detour,
  // and draws it better: on CFT073's own coordinates, where the seven K12 genes
  // are absent rather than merely unaligned.
  //
  // Adding a lane here would also argue against this frame's own point. The
  // figure exists to say that `carriedBy` states something the flattened
  // projections cannot, so a projected row saying "CFT073 alone" sitting above
  // it reads as a rebuttal rather than as support.
  {
    mode: 'url',
    name: 'pangenome/pggb_carriage',
    // FORCE, not sample rows, for two reasons that are both about the drawer.
    // It takes ~40% of the width, which is the axis sample rows needs for its
    // labels and its backbone; and sample rows packs every rank-0 node into one
    // line, so at this zoom a 59 bp segment is ~10px with 1 bp neighbours either
    // side and the click resolved to s119713 instead. Force separates them.
    url: pggbLocusSession('force', {
      region: PGGB_ROWS_LOCUS,
      window: PGGB_ROWS_WINDOW,
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    settleMs: 8000,
    viewportWidth: 1100,
    // 780 clipped the drawer's attribute table by 221 css px, from the run's own
    // report; the drawer is the taller half here, not the graph
    viewportHeight: 1000,
    hideTooltip: true,
    actions: [
      { type: 'click', anchor: { view: 1, graphNode: '119715-' } },
      // gate on the drawer's own content rather than a delay: a missed click
      // would otherwise commit a figure of a graph with no panel open
      { type: 'waitForText', text: 'carriedBy' },
      { type: 'delay', ms: 1500 },
    ],
    // WHERE, which the frame never said (review: "It is not obvious though???
    // where??"). The drawer names 119715 and lists its four carriers, and the
    // graph beside it drew 61 nodes with nothing marking which one that is —
    // the tooltip in the corner is the only tie, and it reads as a hover
    // artefact. A ring anchored on the node id follows the drawing if the
    // layout re-runs, which a viewport coordinate could not.
    //
    // The second ring is the other half of the same review ("it could be
    // interesting to show 'insertions' like this"): 118465 is CFT073's 75 bp
    // detour, the one rank-1 node here and the reason 119715's carriage is a
    // proper subset. The graph already labels it `75 bp`, so the pill only has
    // to say whose it is.
    annotations: [
      { type: 'circle', anchor: { view: 1, graphNode: '119715-' }, radius: 22 },
      { type: 'circle', anchor: { view: 1, graphNode: '118465-' }, radius: 22 },
      {
        type: 'text',
        text: "CFT073's detour",
        fontSize: 17,
        anchor: { view: 1, graphNode: '118465-', dx: 20, dy: -46 },
      },
    ],
  },
  // `pangenome/pggb_spur_linear` was here and is DELETED (review: "delete
  // figure"). It drew CFT073's 7.1 kb deletion on the K12 axis: the pggb VCF
  // record, the seven genes it spans, and the MAF row that goes blank under it.
  //
  // Nothing about that claim is lost, because `pangenome/pggb_strain_launch`
  // below makes it from the side that settles it -- CFT073's OWN coordinates,
  // where ssuE runs straight into pyrD and the seven genes are simply not
  // there. A deletion argued from the reference's absence of sequence is the
  // weaker of the two pictures, and the tutorial was drawing this one event
  // four times (here, the sample-rows pair, the carriage drawer, and the strain
  // launch). The VCF record's coordinates stay in the prose, which is where a
  // number belongs.
  // Carriage as a lane rather than as a drawer field. The figure above answers
  // "who carries this segment" for one node someone clicked; this answers it for
  // every segment across a window at once, which is what the tutorial's
  // core/accessory prose is actually about.
  //
  // The depth track is in the frame because it is the lane's own control. Both
  // read the same graph and disagree about the unit: `odgi depth` is a mean over
  // fixed windows, the lane is one box per segment. Over the IS5 element they
  // agree, and that agreement is the check — a curve stepping down to 1 across
  // the same span the lane draws as a single private box, with the gene track
  // naming the element that explains both.
  //
  // Needs the plugin bundle pinned in the fixture to be 0093d998d280 or later.
  // Before that `getFeatures` parsed the tag column and dropped it, so `carriers`
  // was absent on every feature and this whole lane rendered in the color the
  // expression falls through to.
  {
    mode: 'url',
    name: 'pangenome/pggb_carriage_lane',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        K12_GENES_SESSION_TRACK,
        PGGB_DEPTH_SESSION_TRACK,
        PGGB_CARRIAGE_SESSION_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PGGB_LOCUS_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
            {
              trackId: PGGB_DEPTH_TRACK,
              type: 'LinearWiggleDisplay',
              height: 100,
            },
            {
              trackId: PGGB_CARRIAGE_TRACK,
              type: 'LinearBasicDisplay',
              // one band, not a pile: the rank-0 segments tile K12 without
              // overlapping, so collapsed is the true layout rather than a
              // squeeze, and the lane reads as a single strip of membership
              displayMode: 'collapsed',
              showLabels: 'none',
              height: 90,
              ...CARRIAGE_DISPLAY,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    settleMs: 5000,
    viewportWidth: 1000,
    // 535 clipped 9 css px off the carriage lane, per the run's own report
    viewportHeight: 550,
    hideTooltip: true,
    // WHERE EACH LANE COMES FROM, on the drawing (reviewer: "please make it
    // clear how this figure was made, it is a very cool and important track").
    // The tutorial prints the whole track config in the fence immediately above
    // this figure, but the picture alone gave no hint that the red band is a
    // per-segment tag rather than a called annotation, and the two quantitative
    // lanes are computed two different ways from the same graph -- a windowed
    // mean above, one box per segment below, which is the distinction the
    // paragraph under the figure spends itself on.
    //
    // Anchored to the tracks rather than placed. The depth pill sits over the
    // middle of the window, where the curve has dropped to 1 and everything
    // above it is empty -- on the left flank it covered the axis ticks, which
    // are the one thing in that lane a reader has to read. Three words each;
    // the adapter, the jexl and the odgi command are in the tutorial.
    annotations: [
      {
        type: 'text' as const,
        text: 'odgi depth, windowed',
        fontSize: 15,
        anchor: {
          track: PGGB_DEPTH_TRACK,
          locus: 'chr:1,300,000',
          fracY: 0.3,
        },
      },
      {
        type: 'text' as const,
        // NAMED IN FULL (review: "is this a specific GFA 'tag' like a sam tag?
        // use full naming"). It is: `SM:Z:`, a GFA optional tag in the same
        // TYPE:VALUE form SAM uses, holding the haplotypes that walk the
        // segment. RgfaTabixAdapter puts it on the feature as `samples` and
        // `carriers`, and the colour is a jexl expression over `carriers` --
        // an ordinary FeatureTrack and LinearBasicDisplay with a `color` and a
        // `legend`, NOT a custom display type, which is the other half of the
        // note and is what the tutorial's config fence shows.
        text: 'GFA SM:Z: tag, per segment',
        fontSize: 15,
        anchor: {
          track: PGGB_CARRIAGE_TRACK,
          locus: 'chr:1,299,340',
          fracY: 0.55,
        },
      },
    ],
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
  //
  // Drawn twice, side by side, because the two layouts answer different
  // questions about the same 460 bp and the tutorial asks both. Sample rows says
  // WHICH strain carries a segment — it is the only figure that does, and the
  // rows line up with the MAF lane above them row for row. The Bandage force
  // drawing says what the locus is SHAPED like: the same nodes with nothing
  // holding them to the reference axis, so the bubbles are visible as bubbles.
  // Same window, same tracks, same colors, differing only in layoutMode, which
  // is what makes the pair readable as one graph rather than two.
  {
    mode: 'url',
    name: 'pangenome/pggb_locus_sample_rows_rows',
    url: pggbLocusSession('samplerows', {
      region: PGGB_ROWS_LOCUS,
      window: PGGB_ROWS_WINDOW,
      mafLane: true,
    }),
    // Row labels, not just the toolbar: the layout runs after the graph loads,
    // and the toolbar is up before there is a row to label.
    readySelector:
      'body:has([data-testid="graph-row-label"]) [data-testid="graph-layout-select"]',
    readyTimeout: 120000,
    settleMs: 5000,
    // half the composed width each
    viewportWidth: 830,
    // the two lanes plus the graph's five rows, and nothing under them.
    //
    // DO NOT raise this to the force half's 1230 to square the composite. The
    // white slab `+append` leaves under this side is the sample-rows PANE being
    // shorter, not the capture; the pane sizes itself to its five rows, so at
    // 1230 the app frames came out identical and the extra 335 css px landed as
    // blank page inside this part, which the run then reports as "blank below
    // the last content". Rendered both ways.
    viewportHeight: 895,
    hideTooltip: true,
  },
  {
    mode: 'url',
    name: 'pangenome/pggb_locus_sample_rows_force',
    url: pggbLocusSession('force', {
      region: PGGB_ROWS_LOCUS,
      window: PGGB_ROWS_WINDOW,
      mafLane: true,
    }),
    // No row labels to wait on here, and the FMMM engine is remote: the same
    // allowUnsettled + long settle the other force half uses.
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 830,
    // The force drawing fills a box rather than five rows, so this half is
    // taller and its pane has to be tall enough for the whole drawing: at 1000
    // the FMMM output ran out the bottom of the pane, and a graph figure cut
    // off mid-edge reads as a broken layout rather than a tall one. `+append`
    // pads the shorter half.
    viewportHeight: 1230,
    hideTooltip: true,
  },
  {
    mode: 'compose',
    name: 'pangenome/pggb_locus_sample_rows',
    // Sample rows first: it is the half the surrounding prose is about, and the
    // half whose rows pair with the MAF lane. The force half follows as the
    // same graph with the axis let go.
    parts: [
      'pangenome/pggb_locus_sample_rows_rows',
      'pangenome/pggb_locus_sample_rows_force',
    ],
    direction: 'horizontal',
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
  //
  // It was a left+right pair with a force half, added on review ("should have
  // the force directed bandage graph version also"); that half is gone and the
  // force drawing of this locus is one figure up, in pggb_locus_sample_rows —
  // see the note on localSubgraphSpec.
  localSubgraphSpec(),
  // The haplotype paths drawn: every edge carries one stroke per P record that
  // crosses it, so each arm of a bubble is coloured by the strains that take
  // it. That is the one thing the graph states and none of the linear
  // projections can — carriage of an allele that has no reference coordinate
  // to be projected onto.
  //
  // THE IS5 BUBBLE, not the 561 bp window this used to draw (review:
  // "unfortunately not interesting screenshot"). That window is flat: pggb cuts
  // a segment at every SNP, so every allele in it is a 1 bp stub and the
  // coloured strokes were specks on a grey line. Here the two arms are 1,199 bp
  // and 0 bp, which is a shape rather than a texture, and the four strains that
  // skip the element are four strokes on one arc.
  //
  // It is deliberately the locus the coarse tier arrows, because that is the
  // section this one answers: the tabix cut rebuilds segments and links only,
  // so it has no P lines and this setting has nothing to draw. The file route
  // keeps them. (An index cut of this same bubble, pggb_locus_graph, used to
  // sit further up the page and was deleted as an unreadable near-duplicate of
  // this one.)
  //
  // Nodes go grey, unlike every other figure on the page. Depth is a per-node
  // quantity and carriage is a per-path one, and drawn together the viridis
  // ramp's green is a strain colour and its purple is another: two colour
  // systems in one drawing, neither readable. Grey nodes leave the colour to
  // the paths, which is what this figure is about.
  //
  // K12's stroke is the one missing from the deletion arc, and that is the
  // finding rather than a gap: it is the strain that walks the element.
  //
  // FORCE with bubble spread 'open' and layout quality at its top setting.
  // Anchored puts x on the reference, and the deletion arc bows out by 0.35x the
  // drawn length of the backbone it bypasses — 1,199 bp of it here — which is
  // deeper than the two-row anchored pane, so the arc draws off the bottom of
  // it. Under FMMM at Bandage's own proportional scale the 1,199 bp node snakes
  // across the frame and crosses everything; 'open' gives the 1 bp alleles a
  // floor, which pulls the drawing into a chain of legible lenses with the IS5
  // bubble the largest of them.
  //
  // `layoutQuality: 4` is FMMM's iteration budget (review, on the sibling graph
  // figures: "are you sure you can't iterate it more times for better layout?").
  // It is the view's Layout quality setting, and the answer is yes and it
  // matters: the model default 1 is 15 fixed + 10 fine-tuning iterations, 4 is
  // 120 + 60 (graphlayout.cpp), and at 1 this drawing had the bubble crossing
  // three other edges where at 4 it is a clean lens with the small bubbles
  // strung off it. The cost is milliseconds at this size, which the header's own
  // layout timing states.
  {
    mode: 'url',
    name: 'pangenome/pggb_haplotype_paths',
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, PGGB_MAF_SESSION_TRACK],
      views: [
        // THE SAME EVENT IN COORDINATES, ABOVE THE GRAPH (review: "showing the
        // lineargenomeview with MAF at same time might help"). The graph pane
        // has no axis -- that is what a force drawing gives up -- so on its own
        // it says four strains take an arc past a node without saying where in
        // K12 that is or what is there. The MAF answers both from a file the
        // graph had no part in: over `chr:1,299,498-1,300,697` the four rows
        // that skip the element go white and K12's stays, which is the same
        // carriage the coloured strokes below draw, arrived at through an
        // alignment rather than through P records.
        //
        // The gene lane makes it the IS5 element by name (`insH21`), so the
        // bubble is an object rather than a shape.
        //
        // The graph is a GFA FILE and the lane is the tabix index, which is why
        // this figure is two views of the same locus rather than a launch: the
        // indexed route rebuilds segments and links only, so it carries no P
        // records and `drawPaths` would have nothing to draw. That is also the
        // answer to "showing how this was launched might help" -- there is no
        // launch to show here, the route is Add -> Graph genome view with the
        // `.gfa`, which the user guide's Route 2 documents.
        {
          type: 'LinearGenomeView',
          displayName: 'The same 1.4 kb in K12 coordinates',
          assembly: 'K12',
          loc: PGGB_LOCUS_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
            {
              trackId: PGGB_MAF_TRACK,
              type: 'LinearMafDisplay',
              layout: PGGB_STRAIN_ROWS,
              showTree: true,
              height: 150,
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          // Kept short enough not to truncate: the pane title ellipsised at
          // "...by which strain ...", which reads as a bug rather than as a
          // title. The path legend beside the drawing names the strains, so the
          // title does not have to say what the coloring is keyed on twice.
          displayName: 'The graph over that interval, colored by strain',
          gfaLocation: { uri: `${DATA}/ecoli_pggb_is5.gfa` },
          layoutMode: 'force',
          layoutQuality: 4,
          // A floor, where the sibling graph figures compress, and the two are
          // not interchangeable. This one is about carriage, which is now drawn
          // along the NODES as well: each is split into five lanes in the
          // legend's order, and a strain that skips a node leaves its lane
          // empty (review: "the edges between nodes are too small to see the
          // paths ... even coloring the length of the nodes using the
          // per-sample colors"). The 1,199 bp arm is a single K12 lane, which
          // is the finding stated outright rather than inferred from the arc
          // four strains take. A floor is still what keeps the 1 bp alleles
          // from clamping to stubs whose lanes have no length to run along;
          // 'compress' pulls the deletion arc towards the mean and the strokes
          // on it crowd into the colour pile-up drawPaths is prone to. Rendered
          // both.
          bubbleSpread: 'open',
          colorScheme: 'grey',
          referencePath: 'K12',
          drawPaths: true,
        },
      ],
    }),
    // Both, so the capture cannot land after the drawing and before the legend
    // that names its colours: the legend is DOM beside the canvas, and
    // perf-stats rather than a row label because force draws no rows.
    readySelector: `body:has([data-testid="graph-path-legend"]) ${GRAPH_DRAWN}`,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 10000,
    viewportWidth: 1000,
    // the force pane runs to its 600px cap here and the five-row legend fits
    // inside it, plus the gene lane and the five MAF rows above; 1130 cut 15
    // css px, from the run's own report
    viewportHeight: 1145,
    hideTooltip: true,
  },
  // pangenome/pggb_collapsed_repeat was here and is RETIRED (review:
  // "unfortunately not interesting screenshot"). It drew the rRNA cut
  // (ecoli_pggb_rrna.gfa) with the paths on, and the graph is a six-node chain
  // whose three long nodes carry no strokes — drawPaths paints edges, and this
  // cut's edges are the five joints between them. So the frame was one long
  // empty grey snake with five specks of colour on it whichever layout drew it,
  // and the only finding in it (one CFT073 copy taking the other side of a 1 bp
  // bubble) was a single stub. The rRNA operon collapse is told in coordinate
  // space by pangenome/pggb_untangle, on the same graph and the same gene, and
  // the tutorial section keeps the `odgi extract -d` recipe without a figure.
  ...graphResolutionPartSpecs(),
  {
    mode: 'compose',
    name: 'pangenome/graph_resolution',
    parts: [
      'pangenome/graph_resolution_minigraph',
      'pangenome/graph_resolution_pggb',
    ],
    // Left+right, minigraph first, because the halves are read as "what the
    // same window looks like as you go from SV resolution to base resolution"
    // and that reads left to right. Stacking them would put two graph panes at
    // different vertical offsets under two identical linear views, where the
    // eye compares the linear halves rather than the graphs.
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
          // The view's own default, which is what a launch taken by hand opens
          // on. This used to state `auto` so the graph's backbone lined up under
          // the segments lane; review took that off every figure whose subject is
          // not the layout itself ("the backbone graphs are too hard to
          // understand ... if we wanted linear, we'd use our lineargenomeview"),
          // and the shared reference-position ramp is what still ties a block in
          // the lane to its node below. pangenome/local_subgraph is where the two
          // layouts are drawn side by side.
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
    // sizes itself to its drawing, and a force drawing is about as tall as it is
    // wide where the anchored one this used to capture was a few flat rows.
    viewportHeight: 1000,
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
  // alignment rows the partner windows come from, and for the 100 kb this now
  // draws.
  //
  // Every row carries its own genes (strainGeneLane), so a partner row states
  // what it holds where the island is missing rather than being a bare ruler
  // under a ribbon.
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
          // Default alpha. This spec used to halve it, because wfmash maps
          // all-to-all in both directions and the adapter unioned both
          // perspectives of the anchor, so every band was two ribbons over one
          // span — the "polygons are oddly darker than expected" of two review
          // rounds. AllVsAll{,Indexed}PAFAdapter drops the second statement of a
          // homology now (markReciprocalDuplicates), so the compensation would be
          // half the ink for one ribbon.
          //
          // A third round ("some ribbons darker than others, do not want this")
          // was the same defect surviving in the cases where the two directions
          // chain a homology into DIFFERENT numbers of blocks, which is most of
          // this file's long alignments; the dedupe recognises those now too.
          // 70, from 150 then 95 (reviewer: "improve y-screen real estate with
          // shorter synteny levels, and shorter graph panel", then "try to
          // reduce screenshot height even further"). Two 150px bands were 300 of
          // a 1580px frame spent on ribbons that neither cross nor stack: each
          // band is a handful of wide blocks going almost straight down, and the
          // claim they carry is where they STOP, which a shorter band states
          // just as well. 70 is the floor for that claim — below it the top
          // band's unbroken run and the bottom band's left edge stop being
          // separable at a glance.
          levelHeights: [70, 70],
          views: [
            {
              assembly: 'NCTC86',
              loc: PAA_NCTC86_WINDOW,
              tracks: [strainGeneLane('NCTC86_genes')],
            },
            {
              assembly: 'K12',
              loc: PAA_SYNTENY_WINDOW,
              // The island rather than s502's span. The ring below still marks
              // s502 inside it, so the three objects the shade used to tie
              // together — gene block, segment, node — are now shade, ring and
              // node, and the shade is free to be the thing the figure is about.
              highlight: [PAA_K12_ISLAND_HIGHLIGHT],
              tracks: [
                strainGeneLane('K12_genes'),
                {
                  trackId: ECOLI_SEGMENTS_TRACK,
                  type: 'LinearBasicDisplay',
                  color: referencePositionColor(PAA_RAMP_DOMAIN),
                  height: 50,
                },
              ],
            },
            {
              assembly: 'Sakai',
              loc: PAA_SAKAI_WINDOW,
              // The other half of the substitution, in Sakai's own coordinates.
              // Without it the frame showed one marked block and one blank band,
              // which reads as a deletion.
              highlight: [PAA_SAKAI_ISLAND_HIGHLIGHT],
              tracks: [strainGeneLane('Sakai_genes')],
            },
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
          // The shorter graph panel review asked for, and the RIGHT lever for
          // it: `paneHeight` replaces GraphGenomeView's built-in 600px ceiling,
          // so the whole drawing scales down to fit. Cutting the capture's
          // viewportHeight instead just clips the bubble off the bottom, which
          // is what an earlier attempt at this did.
          //
          // NOT a layout change. Force-directed is the point of the figure --
          // one long backbone node with the rest of the graph looping past it --
          // and an anchored layout draws that loop flat against the backbone it
          // replaces.
          //
          // 340, from 600 then 430. The drawing scales rather than crops, and
          // the loop is a shape rather than a reading, so it survives the
          // scaling; what stops this going lower is the per-node bp labels,
          // which do NOT scale and start colliding as the nodes close up.
          paneHeight: 340,
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    // the three strain rows (a gene lane each, and the segments lane on K12),
    // the two ribbon bands and the graph pane, all three shorter than the 1580
    // this started at. Measured off the run's own CONTENT CLIPPED BELOW THE
    // FOLD rather than guessed, and it follows `paneHeight` above rather than
    // driving it: the pane is the graph's, so shortening the capture alone
    // clips the bubble instead of scaling it.
    viewportHeight: 1160,
    hideTooltip: true,
    // One ring in each half, on the same segment (review: "we may want to circle
    // entries in the lineargenomeview/linearsyntenyview and the correspondence
    // in graphgenomeview"). The shared hue already says they are the same
    // object, but only to a reader who thinks to compare two panes 700px apart;
    // the pair of rings is what makes the reader look.
    //
    // Both are anchored by NAME, not by pixel: the lane's by s502's own span out
    // of the segs index (PAA_ISLAND_HIGHLIGHT, which draws the shaded band over
    // the same bp), the graph's through the view's nodePositions, so the ring
    // follows the node when the layout moves.
    annotations: [
      {
        type: 'circle',
        anchor: {
          view: [0, 1],
          track: ECOLI_SEGMENTS_TRACK,
          locus: `chr:${PAA_ISLAND_HIGHLIGHT.start}-${PAA_ISLAND_HIGHLIGHT.end}`,
        },
        // the 50px lane, ringed a little proud of it. The block is ~150px wide
        // here, so a ring sized to the whole segment would swallow its
        // neighbours; this marks it without hiding what it sits between.
        radius: 34,
      },
      {
        type: 'circle',
        anchor: { view: 1, graphNode: 's502' },
        // resolves to a point ON the node's polyline rather than its bounding
        // box, which for a node bent into an arc is the empty space inside it
        radius: 40,
      },
      // WHAT THE BLANK HALF OF THE LOWER BAND IS (review: "there is a weird
      // area of where no synteny ribbons are drawn between k12 and sakai, are
      // they just completely distinct genes in this region? what is the story?").
      //
      // It is a SUBSTITUTION rather than an absence, which is the part a blank
      // band cannot say. Sakai's alignment to K12 ends at K12 1,419,704 and
      // resumes at 1,474,096, so 54,392 bp of K12 has no Sakai block; if Sakai
      // simply LACKED that sequence its two blocks would meet and its window
      // would be 54 kb shorter than K12's over the same flanks. It is 15 kb
      // LONGER (the two offsets differ by 14,812 bp), i.e. Sakai carries ~69 kb
      // of its own where K12 carries ~54 kb of its own.
      //
      // WHAT IS IN THE TWO SPANS, off the hosted GFFs rather than off the
      // picture (`tabix .../K12.gff.gz chr:1419704-1474096` and
      // `.../Sakai.gff.gz chr:1920861-1990065`, the second being the first
      // carried through Sakai's two offsets):
      //
      //     K12    48 genes: paaA-paaZ + paaX/paaY, feaB/feaR/tynA, the Rac
      //            prophage (racR, rzoR, stfR, tfaR, pinR, ydaS-ydaY, ynaA/E/K)
      //            and four IS elements
      //     Sakai  77 genes: 58 ECs_ locus tags plus nleG2-2, nleG5-1, nleG6-1
      //            (O157 non-LEE effectors), pfo, recE/recT/racC, argO4, ileZ4
      //
      // SEVEN SYMBOLS ARE SHARED (hslJ, ldhA, uspF, ydbH, ydbJ, ydbL, ynbE), so
      // "completely distinct genes" -- the reviewer's guess, and what an earlier
      // draft of this comment asserted -- is not right and the callout must not
      // say it. The honest reading is an island per strain with the shared
      // backbone genes interrupted on both sides, which is why no chain spans it.
      //
      // AND THE PILL THAT USED TO SAY ALL OF THAT IS GONE. It read "No ribbon:
      // each strain carries its own island here. K-12 the paa operon, Sakai
      // nleG effector genes", sitting in the blank band, and it was the figure
      // (review: "we are relying on textbox to tell the whole story, ideally
      // the data viz tells the story").
      //
      // Every clause of it is drawn now. "No ribbon" is the blank band, which
      // was always visible and only needed something either side of it to be
      // about; "each strain carries its own island here" is the two shaded
      // blocks, one per row, which is the half that was missing and without
      // which the frame read as a deletion; and the two names are those blocks'
      // own labels, written by the app at the coordinates they belong to
      // instead of in a box 40 kb to the left of one of them.
      //
      // What the picture cannot say -- which genes, that seven symbols are
      // shared across the two spans, that Sakai's island is the longer -- is on
      // the page under the figure, where it can be attributed. The rule this
      // follows is website/CLAUDE.md's: a callout naming the most obvious thing
      // in the frame is deleted rather than reworded.
      // What the grey half of the drawing is (review: "unclear why this isnt
      // more of a rainbow palette also"). The ramp IS on -- it is the same
      // reference-position ramp the lane above uses, which is what makes the
      // island green in both panes -- but a ramp over K12 coordinates can only
      // color segments that HAVE one, and about half the nodes in a bubble by
      // definition do not: they are the routes the other strains take past it,
      // carrying their own donor's SN/SO instead. So the grey is the answer to
      // the same question the figure is asking, not a palette that failed to
      // apply, and it says so on the drawing now. s1613 is one of those nodes
      // (SR:i:1 in ecoli_paa_subgraph.gfa), anchored by name like the rings.
      {
        type: 'text',
        text: 'grey = no K12 coordinate: the routes past the island',
        fontSize: 17,
        textAlign: 'end',
        anchor: { view: 1, graphNode: 's1613', alignX: 'left' },
        dx: -14,
      },
    ],
  },
  // NO FIGURE for the per-strain paths track (`ecoli_minigraph_paths`), which
  // graph_genome_view.md still documents and the demo still hosts. Retired
  // after three passes; the last verdict was "align this more with the look and
  // feel of deletions with linearmafdisplay ... if that is not possible we can
  // skip perhaps ... could consider deleting".
  //
  // It is not possible from this file. A MAF row reads as a lane because every
  // aligned column is painted; `minigraph --call` emits a record per BUBBLE and
  // nothing between them, so the lane is only as continuous as the bubble
  // decomposition. Over the 200 kb the figure used, the 20 bubbles cover 24,840
  // bp -- 12% of the frame, and the rest is white. Measured every window in the
  // graph before giving up: the densest 200 kb reaches 64% and the densest
  // 50 kb 91%, but both get there from one 40-44 kb bubble filling most of the
  // frame, which is the "five stacked full-width boxes read as a bar chart"
  // failure the previous pass widened the window to escape. Dense and
  // many-event are opposite directions here.
  //
  // Filling the gaps would mean emitting inter-bubble reference rows from
  // build_minigraph_paths.sh -- and doing that honestly needs each sample's
  // per-bubble contig coordinates chained across the gap, since "no bubble
  // here" is a statement about the graph and not evidence that a given sample
  // aligned there. That is a rebuild and a re-upload of the hosted demo BED,
  // and it was declined.
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
          // the other direction of the round trip this is now composed into;
          // see the matching displayName on rgfa_strain_launch's graph view
          displayName: 'Linear genome view → graph',
          assembly: 'K12',
          loc: SEGMENT_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 110 },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              // the same ramp over the same numbers the graph below is coloured
              // by, so s1275/s1276/s1277/s1278 are the same colour in both
              // frames and the clicked segment can be found in the drawing
              color: referencePositionColor(SEGMENT_LAUNCH_REGION),
            },
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
      // A launch through the menu opens on the view's own defaults, and as of
      // the 'auto' color scheme those now include the reference-position ramp
      // whenever the graph carries reference coordinates — which an rGFA always
      // does. So this stage no longer drives the Color dropdown, and the
      // tutorials no longer tell the reader to.
      //
      // What it used to do, and why it is worth not putting back: two clicks,
      // 'Uniform' (the dropdown goes by its current value, having no testid)
      // then 'Reference position'. REFERENCE POSITION, not Rainbow, and that was
      // a correction rather than a preference. Rainbow was taken for an earlier
      // review ("consider using rainbow coloring for the segments?") because
      // Stable rank is two colours on a 16-node neighbourhood and the arms all
      // painted alike. It does give every segment its own hue — but the hue is
      // the node's INDEX in the fetched node list (GeometryBuilder's 'rainbow'
      // case), so it means nothing, it changes when the window changes, and
      // nothing outside the pane can reproduce it. That last part is what the
      // next review round hit: "the lineargenomeview doesnt seem to be using
      // rainbow", and with rainbow it never could. Reference position is the
      // rainbow that survives all three: a hue ramp along the same coordinates
      // the lane above is drawn on, so the lane can be painted with the
      // identical jexl and the clicked segment is the same colour in both
      // frames. What it costs is the off-reference arms, which go charcoal
      // because they have no reference position — which is what they are, and
      // what every HPRC figure on the site already says.
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
  // THE ROUND TRIP, as one figure, which is what the two halves are for
  // (review, on the neighbourhood half: "this is just 'yet another spur' image.
  // is there anything interesting here? seems like it is the inverse of
  // [rgfa_strain_launch]. if it is that related, consider combining into a side
  // by side 4-part image, clearly saying that it is shared (e.g. graph ->linear,
  // linear->graph)"). It is exactly that related, and separately neither half
  // said so: one was a menu over a graph and a launched linear view, the other a
  // menu over a linear view and a launched graph, in two different sections of
  // the same page, and a reader met the second as a third spur drawing.
  //
  // Each half is already a two-stage capture (menu, then result), so composing
  // the two horizontally IS the 2x2: left column graph -> linear, right column
  // linear -> graph, each column reading down from the click to what it opened.
  // The direction is in each half's own view header rather than in a callout,
  // see the `displayName`s.
  //
  // The two halves are coloured differently on purpose and the caption says so:
  // stable rank on the left, because the question there is WHOSE sequence the
  // arm is, and the reference-position ramp on the right, because the question
  // there is WHERE the segments are -- which is also the ramp the lane above it
  // is painted with, so the clicked segment is the same hue in both frames.
  {
    mode: 'compose',
    name: 'pangenome/rgfa_launch_roundtrip',
    parts: [
      'pangenome/rgfa_strain_launch',
      'pangenome/rgfa_segment_neighbourhood',
    ],
    direction: 'horizontal',
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
    // the linear view rather than 260. Plus the MAF lane and its header.
    viewportHeight: 1250,
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
      // What the ring is around, which the frame did not say: the tooltip gives
      // the node's own length and CFT073 offset, and the band gives the K12
      // interval, but nothing put the two side by side, so review asked "is
      // this a 65kb 'non reference insertion'?". It is. Both numbers are the
      // graph's, not arithmetic on a picture: s2037 is 65,410 bp
      // (`ecoli_minigraph.segs.bed.gz`), and it attaches to s402 and s405,
      // which leaves K12 chr:1,095,502-1,097,564 between them — the same
      // 2,062 bp the hover band is drawing.
      //
      // IT WAS DRAWN OFF THE BOTTOM OF THE FRAME. `dy: 90` off a node the force
      // layout puts at the foot of a 1250 px capture lands at ~1299, and an
      // annotation outside the viewport is not an error — `drawAnnotationOverlay`
      // only reports an anchor that resolved to NOTHING, and this one resolved
      // fine and then painted past the edge. So every review of this figure has
      // been of a bare red ring with no text anywhere near it ("unclear what the
      // red circle is"), and the answer was in the spec the whole time. It goes
      // right of the loop now, into the empty half of the pane.
      //
      // THE PILLS LEAD WITH THE INSERT NOW (review: "this is confusing because
      // it says 'k12 has 2.1kb here' like that is important but it seems the
      // important part is the cft073 sequence"). Right: the two used to state a
      // length each and leave the reader to notice which was the subject, and
      // the reference's length is the one that read as the claim because it is
      // in the upper panel. Each says what its own panel cannot instead -- what
      // the ringed node IS, and what the band IS -- and the two lengths move to
      // the caption, where a number is allowed to be checked rather than
      // believed.
      {
        type: 'text',
        text: 'the ringed node is sequence only CFT073 carries',
        anchor: { view: 1, graphNode: HOVERED_ALLELE },
        dx: 300,
        dy: -60,
        maxWidth: 230,
        fontSize: 16,
      },
      // AND THE BAND SAYS WHAT IT IS, which is the other half of the same
      // complaint ("it is not matching the highlight over the lineargenomeview
      // afaict"). It does match: the band is where the ringed node's two links
      // touch down, so it is the insert's attachment point rather than a second
      // measurement of it. Saying that is what makes the 30x difference between
      // the band and the node read as the comparison the figure exists to make.
      // Anchored to the band's own K12 interval, above the gene lane, so it
      // moves with the coordinates rather than with a measured pixel.
      {
        type: 'text',
        // Named, not "it": this pill is in the UPPER panel and the node it is
        // about is in the lower one, so a pronoun points at a panel the reader
        // has not reached. Naming CFT073 here is also what puts the insert in
        // the frame a reader meets first, which is the review's own ask.
        text: 'the CFT073 insert attaches to K12 inside this band',
        // Right edge against the band's LEFT edge, so the pill sits beside the
        // band rather than starting at its midpoint and running off to the
        // right of it — which is what a bare locus anchor does, since textAlign
        // only offers start and end and the pill's width is not known here.
        textAlign: 'end',
        anchor: {
          track: 'K12_genes',
          locus: 'chr:1,095,502-1,097,564',
          alignX: 'left',
          fracY: 0,
          dx: -6,
          dy: -16,
        },
        fontSize: 16,
      },
    ],
  },
  // THE SAME INSERTION AS AN ALIGNMENT (review on rgfa_hover_sync: "if possible
  // show this in a synteny view too. that is very convincing"). It is, and it is
  // a different KIND of evidence rather than a second drawing of the same one:
  // the hover figure's claim comes out of the graph's own index — s2037 is
  // 65,410 bp of CFT073 and its two links land 2,062 bp apart on K12 — and this
  // one comes out of wfmash's all-vs-all alignment, which the graph had no part
  // in. Two files agreeing is what makes it convincing.
  //
  // Coordinates are the graph's, not measured off a picture:
  // `node scripts/probe-graph-nodes.ts pangenome/rgfa_hover_sync` prints s2037
  // at `CFT073#1#chr:1,175,651` with length 65,410, and its neighbours s402
  // (K12 chr:1,095,051 +451) and s405 (K12 chr:1,097,564), which is the 2,062 bp
  // the hover band draws.
  //
  // The two panels are at wildly different scales on purpose -- 28 kb of K12
  // against 138 kb of CFT073 -- because that IS the finding. Each panel is its
  // own view with its own bp/px, so the flanks still align ribbon to ribbon and
  // the 114 kb between them lands on nothing at all.
  //
  // ZOOMED OUT (review: "zoom out please"), and the zoom-out found a
  // registration bug the old crop was hiding. The windows are now derived from
  // the PAF's own chain ends rather than from the graph's segment interval:
  // `tabix ecoli_pggb_ava.pif.gz 'tK12#1#chr:1050000-1150000'` gives two chains
  // to CFT073, K12 887,944-1,094,152 <-> CFT073 942,350-1,127,332 and K12
  // 1,097,432-1,183,704 <-> CFT073 1,241,061-1,327,893, so each window is its
  // chain end plus ~12 kb of flank and the two edges map onto each other. The
  // old CFT073 window started at 1,170,000 -- 43 kb PAST where the left flank
  // reaches it -- so the left ribbon left the frame at the bottom-left corner
  // and only the right flank was actually registered.
  //
  // The shaded block is the alignment's, not the graph's: the CFT073 span that
  // no K12 chain touches at all. The node the hover figure rings is the last
  // stretch of it (s2037 runs 1,175,651-1,241,061, ending exactly where the
  // right chain resumes) and what precedes it is the same bubble's s2030-s2036,
  // all rank 2 -- so at the old crop the frame showed part of the gap and
  // labelled it the whole of it.
  //
  // NOTHING DRAWN ON TOP. Two pills used to name the block and the K12 gap, over
  // a 10% grey highlight on each. Once the frame was widened to its chain ends
  // the pills were describing the most obvious thing in it (review: "the text
  // annotations here are...frankly nonsense. like its obvious there is a big
  // gap. what is the point?") -- the rule now written down in
  // website/CLAUDE.md. The highlights went with them for a duller reason: at
  // that alpha neither was visible in the capture, so they were a setting the
  // figure did not have.
  {
    mode: 'url',
    name: 'pangenome/rgfa_insertion_synteny',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [[ECOLI_AVA_TRACK]],
          drawCurves: true,
          levelHeights: [200],
          views: [
            {
              assembly: 'K12',
              // the 3.3 kb the two chains leave, plus ~12 kb of flank either
              // side so both flank ribbons are ribbons rather than frame edges
              loc: 'chr:1,082,000-1,110,000',
              tracks: [strainGeneLane('K12_genes')],
            },
            {
              assembly: 'CFT073',
              // the same two chain ends carried through the alignment, so the
              // left edge (1,115,000) is where K12 1,082,000 lands and the
              // right edge is where K12 1,110,000 does
              loc: 'chr:1,115,000-1,253,000',
              tracks: [strainGeneLane('CFT073_genes')],
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    settleMs: 8000,
    // wider than the 1000 the tighter crop used: 5x more CFT073 in frame at the
    // same 1000 px would have cost the gene lane its labels, which the caption
    // reads the cluster's names out of
    viewportWidth: 1400,
    // two gene lanes, two rulers and the 200 px band between them
    viewportHeight: 582,
    hideTooltip: true,
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
          // The view's own default drawing, per review: "we need to just use
          // force directed bandage graphs. the backbone graphs are too hard to
          // understand. across all our figures. backbone too complicated. if we
          // wanted linear, we'd use our lineargenomeview." Sample rows drew this
          // subgraph as a K12 line with five labelled rows of stubs under it,
          // which is the linear reading of a graph and the one a linear view
          // already gives. The menu this figure is about names each strain
          // itself, so nothing here needed the row labels.
          layoutMode: 'force',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    // the row labels went with the sample-rows layout; the toolbar is what says
    // a force drawing has arrived
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    // the taller of the two frames, which is now the graph plus its cascade: a
    // force drawing is about as tall as it is wide where the five sample rows
    // were flat. The synteny frame sets its own below.
    viewportHeight: 820,
    hideTooltip: true,
    stages: [
      {
        // The graph pane plus the cascade hanging off its menu. This is also the
        // viewport stage two ACTS in — a stage resizes after its own actions —
        // and below ~430 the synteny item click stops launching anything
        // (verified at 350 and 410 against the sample-rows drawing: the debug
        // capture shows the menu dismissed and no view added). Cause not
        // established; treat 430 as a measured floor rather than a tidy number.
        viewportHeight: 820,
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
            selector: displayPainted('synteny_canvas'),
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
  //
  // Frame two closes the graph pane once the launch has happened, the same as
  // rgfa_launch_out_menu and for the same reason. It also stopped the figure
  // failing: a force drawing is 700px where the sample rows were 300, so the
  // launched view sat at the bottom of the page with its gene track's second row
  // off-screen, and the floating label the readiness wait keys on is only
  // emitted for a row the display draws.
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
          // WHICH DIRECTION THIS HALF IS, in the app's own title bar rather
          // than as a fifth red rectangle over the drawing. This figure and
          // rgfa_segment_neighbourhood are the two directions of one round
          // trip and are now composed side by side, so each half has to say
          // which way it runs (review: "consider combining into a side by side
          // 4-part image, clearly saying that it is shared (e.g. graph
          // ->linear, linear->graph)"). A view header falls back to the
          // assembly name, which was `E. coli K12` on both halves.
          displayName: 'Graph → linear genome view',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: PKS_REGION,
          // The view's own default drawing. This was one row per strain, so that
          // the 58.6 kb CFT073 arm had a row label saying whose it was; the
          // review that took the sample rows off rgfa_launch_out_menu applies
          // here too ("backbone too complicated ... across all our figures"), and
          // the attribution is not lost — the menu row the figure boxes is
          // `CFT073 chr:…`, which names the strain and its coordinates.
          layoutMode: 'force',
          colorScheme: 'stable-rank',
          // No layoutQuality here, which is a per-figure call rather than a
          // rule. It IS a spec prop — `layoutQuality: 4` is how
          // hprc_amylase_graph untangles its backbone and how
          // pggb_haplotype_paths gets a clean lens out of the IS5 bubble, and
          // the same setting is a radio in the view's own Settings dialog — so
          // any figure that draws better with more iterations can just say so.
          // This one does not: rendered at 4, the extra budget spreads an
          // 11-node cut until zoom-to-fit lands at 265% and the 58 kb CFT073
          // arm runs off both edges of the pane. More iterations minimise
          // FMMM's energy, not the drawing's aspect ratio. What was wrong was
          // the floor under all of them, and that is fixed in the plugin: the
          // view defaulted to quality 1 where Bandage's own default is 2
          // (program/settings.cpp).
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    settleMs: 3000,
    viewportWidth: 1000,
    // the taller frame, which is the force drawing plus its cascade
    viewportHeight: 820,
    hideTooltip: true,
    stages: [
      {
        // The graph pane plus the cascade hanging off its menu. This is also the
        // height stage two ACTS at (a stage resizes after its own actions), so
        // it has to hold the launched view long enough for its gene track to
        // draw as well; 340 -- which would have trimmed the ~99px of blank the
        // sample-rows drawing left under the cascade -- made the "CFT073 chr:"
        // click launch nothing at all, the same floor rgfa_launch_out_menu
        // measured at ~430. Treat it as measured rather than tidy.
        viewportHeight: 820,
        // Which nodes the menu row below is about (review: "it is unclear what
        // the path the lineargenomeview takes through this graph"). The colors
        // already say it -- `stable-rank` puts K12's rank-0 backbone in one hue
        // and CFT073's rank-2 segments in another -- but nothing on the drawing
        // said which was which, so the reader had a two-color graph and a menu
        // row and no way to connect them. Both labels are anchored by node NAME
        // through the view's nodePositions (probe-graph-nodes.ts prints the ids
        // with their ranks and lengths), so they follow the FMMM layout instead
        // of being measured off a PNG.
        //
        // s2132 is CFT073#1#chr:2,258,597 +58,610 bp, which is 58.6 kb of the
        // 64.7 kb window the launched view's header shows in the frame below --
        // so the arm IS very nearly the path, and the rest of it is backbone
        // CFT073 shares with K12.
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
          // ...and WHICH node that last row is about, in three words. This was
          // two sentences -- the arm's share of the launched window, and a key
          // reading "blue = shared with K12" on the other node -- and the review
          // that followed was "it has text annotation on the graph and the menu
          // items. that is too much". Both were true and neither was needed at
          // that length: the menu row this figure boxes already names the strain
          // and its coordinates, so the arm only has to be identified as the
          // same one, and the caption carries what stable rank means. The
          // arithmetic (s2132 is CFT073#1#chr:2,258,597 +58,610 bp against the
          // 64.7 kb the launched view's header shows) moved to the prose beside
          // the figure, where a sentence belongs.
          //
          // Anchored by node NAME through the view's nodePositions
          // (probe-graph-nodes.ts prints the ids with their ranks and lengths),
          // so it follows the FMMM layout rather than a pixel measured off a PNG.
          {
            type: 'text',
            text: 'CFT073 only',
            fontSize: 17,
            anchor: { view: 0, graphNode: 's2132' },
            dy: -70,
          },
        ],
      },
      {
        // Re-opened from scratch rather than clicked out of the cascade stage one
        // left standing: the resize that buys frame one its tight crop lands
        // between the two stages and moves the menu under it, so the strain row
        // would be clicked at its old position. Same reason as
        // rgfa_launch_out_menu.
        closeMenusFirst: true,
        // the launched view alone, once the graph pane below has gone
        viewportHeight: 330,
        actions: [
          {
            type: 'click',
            selector: `${PKS_VIEW} [data-testid="view_menu_icon"]`,
          },
          { type: 'click', text: 'Launch view' },
          { type: 'hover', text: 'Linear genome view' },
          { type: 'waitForText', text: 'CFT073 chr:' },
          { type: 'click', text: 'CFT073 chr:' },
          { type: 'delay', ms: 3000 },
          // and now the graph pane goes, leaving the view it opened. Closed
          // after the launch rather than before it: the menu item lives on the
          // graph view.
          {
            type: 'click',
            selector: `${PKS_VIEW} [data-testid="close_view"]`,
          },
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
