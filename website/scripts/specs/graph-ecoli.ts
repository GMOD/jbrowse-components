// The E. coli pangenome figures: the four-strain minigraph rGFA graph and the
// pggb graph built from the same five assemblies, for the pangenome_ecoli and
// multiway_synteny tutorials.
//
// The human half of what used to be one specs/graph.ts is specs/graph-hprc.ts,
// and the two share only what specs/graph-fixtures.ts holds.
import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  cascadeBoxes,
  menuCascade,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'
import { ECOLI_DEMO_BASE, ecoliPageTrack } from './demoBase.ts'
import {
  GRAPH_DRAWN,
  GRAPH_VIEW_READY,
  graphCutDrawn,
  graphTrack,
  graphTrackMenu,
  cutNear,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'
import { pageFenceText } from './pageTrack.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = local('test_data/graphgenomeview/config.json')
// The only fixture loading the graph's contributing strains as assemblies,
// which is what the outbound launch needs: a node can open the strain it came
// from, and the window can open as a synteny view of the strains in it.
const ECOLI_PANGENOME_CONFIG = local(
  'test_data/graphgenomeview/ecoli_pangenome.json',
)
const DATA = ECOLI_DEMO_BASE
const ECOLI_DOC = 'tutorials/pangenome_ecoli.md'
const ECOLI_SEGMENTS_TRACK = 'ecoli_minigraph_segments'

// Paint the linear segments track in the graph view's own 'Stable rank'
// colors, so the blocks above and the nodes below are the same color for the same
// segment instead of gold-vs-blue. RgfaTabixAdapter puts the SR tag on the
// feature as `rank`, and the plugin's scheme is rank 0 -> rgb(52,152,219), then a
// ramp from rgb(237,137,44) at rank 1 to rgb(158,42,122) at the subgraph's max
// rank. Only rank 0 has reference coordinates, so a reference LGV only ever draws
// the blue backbone; the second interval is the ramp's rank-1 end, for a linear
// view opened on one of the other assemblies. The same scale is in
// demos/hprc, demos/arabidopsis_pangenome and the graphgenomeview fixtures.
const RANK_COLOR_DEFAULTS = {
  color: {
    field: 'rank',
    scale: 'threshold',
    domain: ['1'],
    range: ['rgb(52,152,219)', 'rgb(237,137,44)'],
    labels: ['reference', 'other assemblies'],
    title: 'Segment rank',
  },
}

// The tutorial's own four-strain minigraph graph as an ordinary FeatureTrack,
// hoisted because several specs below draw it as a graph track. It is a session
// track rather than a config track because the shared graphgenomeview fixture
// config carries only the K12 assembly; the two tabix indexes are hosted beside
// the GFAs. Both `RgfaTabixAdapter` and the graph display come from the
// plugin, so a figure that renders this track at all is also evidence the plugin
// loaded.
const ECOLI_SEGMENTS_SESSION_TRACK = {
  type: 'GraphTrack',
  trackId: ECOLI_SEGMENTS_TRACK,
  name: 'minigraph graph segments (rGFA)',
  assemblyNames: ['K12'],
  adapter: {
    type: 'RgfaTabixAdapter',
    uri: `${DATA}/ecoli_minigraph`,
  },
  displayDefaults: RANK_COLOR_DEFAULTS,
}

// The pggb graph itself, browsable by locus — the whole 606k-segment base-level
// graph rather than a window someone cut out of it beforehand.
//
// This is the same `RgfaTabixAdapter` the minigraph tracks use, on the same two
// BEDs, and that is the point: a plain GFA carries no SN/SO/SR tags, but
// walking its P lines assigns every segment it visits an interval, which is the
// same information in a different encoding. gfa-to-tabix does
// that walk offline and emits the exact files the adapter already reads
// (verified against the independent `odgi extract` route: at
// chr:1,004,500-1,004,961 every interval matches). So region query, the subgraph cut, both
// anchored layouts, the node menus and hover sync all work here with nothing
// added to the app.
//
// A base-level graph runs ~17 bp per segment, so the window that fits is small:
// this 3 kb one cuts ~340 segments, where the same 3 kb of the SV-resolution
// minigraph graph is a handful.
const PGGB_SEGMENTS_TRACK = 'ecoli_pggb_segments'
const PGGB_SEGMENTS_SESSION_TRACK = ecoliPageTrack(
  ECOLI_DOC,
  PGGB_SEGMENTS_TRACK,
)

// The same segments as PGGB_SEGMENTS_SESSION_TRACK, colored by how many
// haplotypes walk each one rather than by reference position.
const PGGB_CARRIAGE_TRACK = 'ecoli_pggb_carriage'
const PGGB_CARRIAGE_SESSION_TRACK = ecoliPageTrack(
  ECOLI_DOC,
  PGGB_CARRIAGE_TRACK,
)

// The aggregate the lane is read against: `odgi depth` over fixed windows,
// hosted beside the graph indexes. Same question, different unit.
const PGGB_DEPTH_TRACK = 'ecoli_pggb_depth'
const PGGB_DEPTH_SESSION_TRACK = ecoliPageTrack(ECOLI_DOC, PGGB_DEPTH_TRACK)

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

// 15 kb of the same graph, centred on the same insertion: ten times the 1.6 kb
// the fine index draws, and drawable as a graph only because the track below
// draws one node per BUBBLE. 100 kb put the 1.2 kb element in a sliver.
const PGGB_TIER_WINDOW = 'chr:1,292,500-1,307,500'
const PGGB_TIER_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1292500,
  end: 1307500,
}
const PGGB_TIER_TRACK = 'ecoli_pggb_tier50'
// The one node in the tier that stands for the IS5 element, arrowed in
// pangenome/pggb_bubble_tier. The id is the tier's own -- source segment
// qualified by reference start, which is what `gfa-to-tabix bubbles` emits.
const PGGB_TIER_IS5_NODE = '79945@1299497'

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
// `gfa-to-tabix bubbles` turns the hosted `vg deconstruct` snarl VCF
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
const PGGB_TIER_SESSION_TRACK = ecoliPageTrack(ECOLI_DOC, PGGB_TIER_TRACK)

// The segments track as a graph over the tier window. Past the adapter's
// `coarse.aboveBpPerPx` the track cuts the tier by itself, and the ramp runs
// over the same span as the tier lane's.
const pggbTierCut = graphTrack(PGGB_SEGMENTS_TRACK, {
  color: {
    field: 'position',
    domainMin: PGGB_TIER_REGION.start,
    domainMax: PGGB_TIER_REGION.end,
  },
})

// The per-strain window, which cannot be the kilobase above (review of the sample
// rows figure: "too chaotic. too many tiny segments ... I know it shows the per
// sample rows but i just dont get it"). pggb cuts a segment at every variant, so
// that window is 154 nodes -- about 6 px each, and a row of 6 px marks says
// nothing about what a strain carries. This is the ycbF/pyrD window, where the
// same index returns 37 segments, the long ones are 59 and 158 bp, and the
// strains genuinely differ: CFT073's contig only reaches the last 293 bp
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

// The graph pangenome/pggb_out_to_strain opens the CFT073 node's menu on: the
// rows window, with the cut held to it.
const PGGB_STRAIN_GRAPH = graphTrack(PGGB_SEGMENTS_TRACK, {
  layoutMode: 'force',
  color: { field: 'rank' },
  maxRegionBp: cutNear(PGGB_ROWS_LOCUS),
  paneHeight: 420,
  // the bubble halos and chips said nothing about the one node this figure is
  // about, and two ran off the pane's edges
  layers: { bubbles: false },
})

// Where pangenome/pggb_out_to_strain starts. The five-assembly config, because
// the node menu offers only assemblies the session has.
const PGGB_STRAIN_LAUNCH = sessionSpec(ECOLI_PANGENOME_CONFIG, {
  sessionTracks: [PGGB_SEGMENTS_SESSION_TRACK],
  views: [
    // K12 across the span the CFT073 segment bypasses, so the frame holds
    // both sides of the event (review: "not a strong figure"): seven
    // genes between ssuE and pyrD here, none in the launched view below.
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: 'chr:996,800-1,005,900',
      tracks: [{ trackId: 'K12_genes', type: 'LinearBasicDisplay' }],
    },
    // The graph in a view of its own: the window above is 7.1 kb of a
    // base-level graph, thousands of nodes, and the node sits in a 460 bp
    // window that draws fine, which the cap holds the cut to.
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: PGGB_ROWS_WINDOW,
      tracks: [PGGB_STRAIN_GRAPH],
    },
  ],
})

// The bubble the hover and sample-rows figures are about: K12
// chr:1,094,197-1,097,573, where Sakai and CFT073 carry ~110-113 kb alleles,
// NCTC86 a 41 kb one, and IAI39 deletes 3.2 kb. Picked off the BED, not by eye:
// `tabix ecoli_minigraph_paths.bed.gz chr:1094000-1098000`. The window is ~5x
// the bubble so the flanking reference-path blocks show it is a local event.
const PATHS_WINDOW = 'chr:1,088,000-1,104,000'
// CFT073's allele at PATHS_WINDOW's bubble — 65,410 bp, the longest thing in
// the cut and the one worth hovering. Named rather than measured: the hover and
// the ring drawn over it both resolve it through the pane's own nodePositions
// (`anchor: { graphNode }`), so neither goes stale when the layout, the pane
// size or the tracks above the graph move. `node scripts/probe-graph-nodes.ts
// pangenome/rgfa_hover_sync` prints the ids a cut contains.
const HOVERED_ALLELE = 's2037'

// A second callout color, for a box pairing one object across two panels, kept
// apart from the red that rings a figure's subject
const SAME_SEGMENT_COLOR = '#1565c0'

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

const K12_IS_TRACK = 'K12_insertion_sequences'
const K12_IS_SESSION_TRACK = {
  ...K12_GENES_SESSION_TRACK,
  trackId: K12_IS_TRACK,
  name: 'K12 insertion sequences',
}

// The 50 kb K12 window the subgraph figure works in, and a segment inside it,
// both picked from the index rather than by eye (`tabix ecoli_minigraph.segs
// .bed.gz 'K12#1#chr:4050000-4100000'`). s1277 spans 4,056,624-4,063,560 and is
// the widest segment there; it is also the only one in the window carrying a
// rank-2 (CFT073) allele, so its neighbourhood has a real bubble in it instead
// of a straight run of backbone.
const ECOLI_WINDOW = 'chr:4,050,000-4,100,000'
const ECOLI_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 4050000,
  end: 4100000,
}
const SEGMENT_LABEL = 's1277'
// s1277's own span padded by half its length either side, the window the
// neighbourhood figure turns into a graph, and the span its lane ramps over.
const SEGMENT_REGION = {
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
// rather than the window. The view takes `color.domainMin`/`domainMax` for that.
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
// The launch carries the graph's own track into the K12 panel, so a segments
// track painted in the graph's reference-position ramp puts the same rainbow on
// both frames (review: "it is not easy to see any 'connection' between the graph
// and the launched synteny view").
const LAUNCH_OUT_SEGMENTS_TRACK = 'ecoli_minigraph_segments_by_position'
const LAUNCH_OUT_URL = sessionSpec(ECOLI_PANGENOME_CONFIG, {
  sessionTracks: [
    {
      ...ECOLI_SEGMENTS_SESSION_TRACK,
      trackId: LAUNCH_OUT_SEGMENTS_TRACK,
      displayDefaults: { color: referencePositionColor(LAUNCH_OUT_REGION) },
    },
  ],
  views: [
    {
      id: 'launch_out_graph',
      type: 'GraphGenomeView',
      loadedTrackId: LAUNCH_OUT_SEGMENTS_TRACK,
      loadedRegion: LAUNCH_OUT_REGION,
      layoutMode: 'force',
      color: { field: 'position' },
      layers: { genes: false },
    },
  ],
})

// K12's asnW/asnU/asnV cluster: three of the four asn tRNA genes, which are the
// sites E. coli pathogenicity islands integrate at. Chosen by scanning the
// segments/links BEDs for a window where one strain contributes a lot and the
// others contribute nothing — here CFT073 brings 58,692 bp in two segments while
// IAI39 and NCTC86 reach it through 1 bp each, so the single long row is
// unambiguous.
//
// 8 kb, and the graph's cut is held to it: a wider one pulls in the
// yersiniabactin island next door, a second long CFT073 arm beside the one the
// figure labels.
const PKS_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 2056000,
  end: 2064000,
}
const PKS_VIEW = '[data-testid="view-container-pks_graph"]'

// The hover figure's session: the genes and the alignment over the bubble,
// with the graph segments track drawn force-directed under them, in the
// reference-position ramp (review: "might want to use rainbow coloring of
// nodes").
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
            rows: { domain: PGGB_STRAIN_ROWS },
            height: 130,
          },
          // No bubble halos, no gene overlay and a shorter pane (review: "it
          // is hard to see the rainbow coloring in the graph. try to reduce
          // bandage graphgenomeviewer height"): the halos and the exon bars sat
          // over the reference nodes' hues, the gene lane above already names
          // the genes, and the 65 kb loop took most of a 600 px pane.
          graphTrack(ECOLI_SEGMENTS_TRACK, {
            layoutMode: 'force',
            color: { field: 'position' },
            layers: { bubbles: false, genes: false },
            size: { field: 'depth', value: 10 },
            paneHeight: 420,
          }),
        ],
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
// strain takes, so a row can be read straight down.
const PGGB_STRAIN_ROWS = ['K12', 'CFT073', 'IAI39', 'NCTC86', 'Sakai']

// pggb's own `-M` MAF, as a session track: the shared graphgenomeview fixture
// config carries the K12 assembly and nothing else, so every track in these
// figures is declared here against the hosted demo's files. Absolute urls, not
// the hosted config's relative ones — a session track's relative `uri` resolves
// against the RPC worker's own url.
const PGGB_MAF_TRACK = 'ecoli_pggb_maf'
const PGGB_MAF_SESSION_TRACK = ecoliPageTrack(ECOLI_DOC, PGGB_MAF_TRACK)

// The same graph read as a callset: `pggb -V K12:...` runs `vg deconstruct` over
// the smoothed graph, so every bubble becomes a record on the K12 axis. It is
// the one lane in this set that can state an alternate route the reference has
// no coordinate for, because a record's ADDRESS is the span the route replaces.
const PGGB_VARIANTS_TRACK = 'ecoli_pggb_variants'
const PGGB_VARIANTS_SESSION_TRACK = ecoliPageTrack(
  ECOLI_DOC,
  PGGB_VARIANTS_TRACK,
)

// The positional-variant track and the two structural-filter spellings that
// used to live here went with `pangenome/pggb_spur_linear`, which was their only
// consumer. Worth knowing if a variant lane comes back to this file: the same
// VCF under a second trackId was deliberate, since a session spec naming one
// track twice keeps only the LAST display.

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
    showBubbles,
    paneHeight = 600,
  }: {
    region: typeof PGGB_LOCUS
    paneHeight?: number
    window: string
    mafLane?: boolean
    variantLane?: boolean
    showBubbles?: boolean
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
                  rows: { domain: PGGB_STRAIN_ROWS },
                  showTree: true,
                  height: 150,
                },
              ]
            : []),
          // The ramp over the window and the cut held near it, so both layouts
          // draw the window's own nodes: at base level a wider cut is a braid.
          graphTrack(PGGB_SEGMENTS_TRACK, {
            layoutMode,
            paneHeight,
            color: {
              field: 'position',
              domainMin: region.start,
              domainMax: region.end,
            },
            maxRegionBp: cutNear(region),
            ...(bubbleSpread ? { bubbleSpread } : {}),
            ...(showBubbles === undefined
              ? {}
              : { layers: { bubbles: showBubbles } }),
          }),
        ],
      },
    ],
  })
}

// The halves of pangenome/graph_context: the paa island cut from the segments
// track twice, at Graph context None and at 1 hop. Same window, same track, same
// colors; the second one follows each off-reference segment's own links one step
// further, which is what turns the dangling arms into bubbles.
//
// Each half is the graph track under the island's genes (review: "I don't
// particularly understand the difference here. At the very least it needs a
// lineargenomeview"), so both halves are the same stretch of K12 twice over.
//
// Reference-position colors, so every off-reference node is the one flat
// charcoal (ALT_ALLELE_COLOR), which is what makes "the added nodes are
// off-reference" visible rather than asserted.
//
// Both halves box THE SAME TWO NODES and say which setting they are (review: "I
// don't particularly understand the difference here. ideally, shows red boxes
// and arrow and/or text annotation showing the difference between the two
// sides"). Without that, the difference is stated only as a node count in a
// header over two FMMM tangles that share no visible landmark, so the reader has
// nothing to compare. Boxed on their ids rather than their positions, so the two
// layouts can put them wherever they like, and one color per node so the pair
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
// both boxes: s2093 and s2095 anchor at the two ends of the 21.8 kb island. So
// the track's cut is held to the window (cutNear).
function graphContextPartSpecs(): ScreenshotSpec[] {
  const DETOUR_ENTRY = 's2093+'
  const DETOUR_EXIT = 's2095+'
  const DETOUR_INTERIOR = 's2094+'
  // One color per node, the same color in both halves, which is what makes the
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
  // The setting's name in the pane's top-left corner, anchored on the canvas
  // rather than on the node-count readout, whose width moves with its numbers.
  const label = (text: string): Annotation => ({
    type: 'text',
    text,
    anchor: {
      selector: '[data-testid="graph-genome-canvas"]',
      alignX: 'left',
      alignY: 'top',
    },
    dx: 12,
    // under the reference strip along the top of the track
    dy: 44,
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
          // No island highlight here, though rgfa_paa_bubble carries one: s502
          // is 21.8 kb of this 29.5 kb window, so the band would cover three
          // quarters of the panel and read as a background tint.
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
            graphTrack(ECOLI_SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              color: { field: 'position' },
              maxRegionBp: cutNear(PAA_REGION),
              subgraphContext,
              // Bandage's own drawn-length power law (review, on all three
              // graph figures: "frankly pretty chaotic screenshot"): the 21.8 kb
              // island draws as an ordinary arc rather than a ring, and the
              // 43 bp detour entrance is a legible lens in the 1 hop half.
              bubbleSpread: 'compress',
              // FMMM's top iteration budget, which takes the crossings out of a
              // drawing this size for milliseconds
              layoutQuality: 4,
              // No halos and no gene pins (review: "are you happy with this"):
              // both halves carried bubble labels that differ between the cuts
              // and read as the finding, where the finding is the boxed stubs
              // closing.
              layers: { bubbles: false, genes: false },
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    // the 1 hop half fires a tabix query per off-reference segment already
    // reached, so it fetches for longer than the plain cut does
    readyTimeout: 180000,
    allowUnsettled: true,
    // half the composed width each
    viewportWidth: 750,
    // the gene lane over the graph track (the 1 hop cut is the taller drawing
    // of the two, so it sets this); re-measure at the reshoot
    viewportHeight: 912,
    hideTooltip: true,
    annotations: [
      ...(
        [
          [DETOUR_ENTRY, ENTRY_COLOR],
          [DETOUR_EXIT, EXIT_COLOR],
        ] as const
      ).map(([graphNode, color]): Annotation => ({
        type: 'box',
        anchor: { graphNode },
        strokeWidth: 3,
        color,
        // a wash the node's own color cannot be mistaken for, so the pairing
        // survives being read at thumbnail size, where a 3px outline does not
        fillOpacity: 0.1,
        // clear of the node's own "43 bp" / "558 bp" label, which the graph
        // writes across the node rather than inside its bounding box
        pad: 22,
      })),
      label(text),
      // the interior only the 1 hop cut reaches, ringed where it draws between
      // the two boxed nodes
      ...(subgraphContext > 0
        ? [
            {
              type: 'circle',
              anchor: { graphNode: DETOUR_INTERIOR },
              radius: 26,
              strokeWidth: 3,
              color: INTERIOR_COLOR,
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

const regionLoc = ({
  refName,
  start,
  end,
}: {
  refName: string
  start: number
  end: number
}) => `${refName}:${start + 1}-${end}`

// What the subgraph tour types into the paste box: the page's fence, so a
// reader watching the clip recognises the block above it on the page. Its URLs
// are the page's, never DATA's. The adapter reads four files off one prefix,
// so `Add a track from file or URL` has no extension to guess from and pasting
// the config is the route.
export const PGGB_SEGMENTS_TRACK_JSON = pageFenceText(
  ECOLI_DOC,
  PGGB_SEGMENTS_TRACK,
)

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
  locusWindow: PGGB_LOCUS_WINDOW,
  tourWindow: PGGB_TOUR_WINDOW,
  // The CFT073 allele pangenome/pggb_out_to_strain opens on its own strain.
  strainLaunchNode: '118465-',
  strainLaunchSession: PGGB_STRAIN_LAUNCH,
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
  // tangle.
  //
  // What the collapse does: 15 kb here is two bubbles, the IS5 element and the
  // insZ element to its left, because a `--min-content 50` tier absorbs every
  // single-base bubble into the backbone and keeps every indel. Each surviving
  // node states what it collapsed (`cn` segments, `cw` traversals, `cs`/`cl`
  // shortest and longest allele), and the IS5 insertion is `cl:i:1200` here.
  // insZ is the frame's control: NCTC86's MAF row runs straight through it
  // while it breaks across insH21 with the other three.
  //
  // Anchored rather than force-directed, which is the opposite choice from the
  // fine figure and for the reason the layout note gives: a tier IS a chain
  // (backbone, bubble, backbone, ...), so there is no graph shape for a force
  // layout to find, and an anchored row puts each bubble under its own
  // coordinate in the lane above it.
  //
  // FORCE WAS TRIED AND RENDERED, so don't re-try it (review: "might benefit to
  // see bandage force directed graph view of bubbles. backbone just tends to
  // not look good"). It turns 27 nodes and 26 edges into a near-vertical thread
  // down one corner of the pane with the IS5 callout off-frame: with no branch
  // structure, the force solver has nothing to spread and returns the chain as
  // a line, while the anchored layout spends the same pixels putting each
  // bubble under its own coordinate. The backbone looking plain is the
  // anchoring working.
  //
  // The graph is the segments track itself: at this zoom it is past the
  // adapter's `coarse.aboveBpPerPx`, so the track cuts the tier.
  {
    mode: 'url',
    name: 'pangenome/pggb_bubble_tier',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        K12_GENES_SESSION_TRACK,
        K12_IS_SESSION_TRACK,
        PGGB_TIER_SESSION_TRACK,
        PGGB_MAF_SESSION_TRACK,
        PGGB_SEGMENTS_SESSION_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PGGB_TIER_WINDOW,
          highlight: [
            {
              assemblyName: 'K12',
              refName: 'chr',
              start: 1299497,
              end: 1300697,
              // light enough that the MAF rows under it still read blank
              color: 'rgba(21,101,192,0.12)',
            },
          ],
          tracks: [
            // K12's own annotation names the element, so the label over the
            // bubble is drawn by the app (review: "there should be features
            // with labels automatically drawn"). The full gene lane draws a
            // hundred genes here and insH21's label is not among the ones
            // that fit; the graph's gene chips below carry the rest.
            {
              trackId: K12_IS_TRACK,
              type: 'LinearBasicDisplay',
              filter: ["jexl:startsWith(get(feature,'name') || '','ins')"],
              height: 50,
            },
            {
              trackId: PGGB_TIER_TRACK,
              type: 'LinearBasicDisplay',
              showLabels: 'none',
              height: 50,
              color: referencePositionColor(PGGB_TIER_REGION),
            },
            // which strains break across each bubble, where the tier says
            // only that they differ
            {
              trackId: PGGB_MAF_TRACK,
              type: 'LinearMafDisplay',
              rows: { domain: PGGB_STRAIN_ROWS },
              showCoverage: false,
              height: 110,
            },
            { ...pggbTierCut, geneTrackId: 'K12_genes', height: 190 },
          ],
        },
      ],
    }),
    readySelector: graphCutDrawn('coarse'),
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 730,
    hideTooltip: true,
    // Charcoal in a tier is a bubble ON K12's coordinates, not an allele off
    // them: `bubbles_to_tier_bed.py` ranks every bubble 1 and every invariant
    // stretch 0. The arrowed bubble spans K12 1,299,497-1,300,697, the element
    // itself; the other four strains take the 1 bp allele.
    //
    // No legend (review: "the red text box overlaps a bunch of stuff"): the
    // tutorial states what charcoal means just above the figure, and the pill
    // covered the Reference row's label. The highlight marks the named
    // feature and its tier block above, and the box its node, which the
    // anchored layout puts at the same x.
    annotations: [
      {
        type: 'box',
        color: SAME_SEGMENT_COLOR,
        strokeWidth: 3,
        pad: 8,
        anchor: { graphNode: PGGB_TIER_IS5_NODE },
      },
    ],
  },
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
  // Before that `getFeatures` parsed the tag column and dropped it, so `sampleCount`
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
            {
              trackId: 'K12_genes',
              type: 'LinearBasicDisplay',
              height: 70,
              // the IS5's nameless mobile_genetic_element record drew labelled
              // by its raw RefSeq ID; insH21 names the element
              filter: ["jexl:feature.type=='gene'"],
            },
            {
              trackId: PGGB_DEPTH_TRACK,
              type: 'LinearWiggleDisplay',
              height: 100,
            },
            {
              trackId: PGGB_CARRIAGE_TRACK,
              type: 'LinearBasicDisplay',
              // tall enough for the five-row legend the display floats over it
              height: 150,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 610,
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
          trackId: PGGB_DEPTH_TRACK,
          loc: 'chr:1,300,000',
          fracY: 0.3,
        },
      },
      {
        type: 'text' as const,
        // NAMED IN FULL (review: "is this a specific GFA 'tag' like a sam tag?
        // use full naming"). It is: `SM:Z:`, a GFA optional tag in the same
        // TYPE:VALUE form SAM uses, holding the haplotypes that walk the
        // segment. RgfaTabixAdapter puts it on the feature as `samples` and
        // `sampleCount`, and the color is a jexl expression over `sampleCount` --
        // an ordinary FeatureTrack and LinearBasicDisplay with a `color` and a
        // `legend`, NOT a custom display type, which is the other half of the
        // note and is what the tutorial's config fence shows.
        text: 'GFA SM:Z: tag, per segment',
        fontSize: 15,
        anchor: {
          trackId: PGGB_CARRIAGE_TRACK,
          loc: 'chr:1,299,340',
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
  // ONE LAYOUT (review: "dunno what is being shown here really. not a strong
  // figure"). What only this figure shows is a strain's row: CFT073's segment is drawn as a bar over
  // the K12 span it replaces, which runs off the left edge.
  {
    mode: 'url',
    name: 'pangenome/pggb_locus_sample_rows',
    url: pggbLocusSession('samplerows', {
      region: PGGB_ROWS_LOCUS,
      window: PGGB_ROWS_WINDOW,
      mafLane: true,
      // the halos and chips stacked over the rows, and one bubble label ran
      // off the pane's left edge
      showBubbles: false,
      // five rows; at 600 they sat in the middle of a blank pane
      paneHeight: 220,
    }),
    // Row labels too: the layout runs after the graph loads, so the track holds
    // a cut before there is a row to label.
    readySelector: `body:has([data-testid="graph-row-label"]) ${GRAPH_DRAWN}`,
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 740,
    hideTooltip: true,
    // The bar's own anchor is its polyline midpoint, thousands of px off the
    // left edge, so the pointer goes in from the graph's second row label,
    // CFT073's. A `text` anchor finds the MAF lane's label first.
    annotations: [
      {
        type: 'text',
        text: 'CFT073 skips this K12 span, and more off the left edge',
        fontSize: 16,
        maxWidth: 260,
        leader: true,
        anchor: {
          selector:
            '[data-testid="graph-row-label"] + [data-testid="graph-row-label"]',
          alignX: 'right',
          dx: 150,
        },
        dx: 330,
        dy: 45,
      },
    ],
  },
  // The indexed route on the tutorial's own four-strain graph: the rGFA
  // segments track over a 50 kb K12 window twice, as a lane and as a graph. A
  // view shows a track once, so the graph is in a second view of the same
  // window, with its cut held to that window and its ramp over it, so a block
  // and its node land on the same hue. The track is declared in the session
  // rather than the config because the config is the shared graphgenomeview
  // fixture; the indexes are hosted beside the GFAs.
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
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: ECOLI_WINDOW,
          tracks: [
            // force rather than anchored, per review on every figure whose
            // subject is not the layout itself ("the backbone graphs are too
            // hard to understand ... if we wanted linear, we'd use our
            // lineargenomeview"); the shared ramp ties a block to its node
            graphTrack(ECOLI_SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              color: {
                field: 'position',
                domainMin: ECOLI_REGION.start,
                domainMax: ECOLI_REGION.end,
              },
              maxRegionBp: cutNear(ECOLI_REGION),
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 90000,
    viewportWidth: 1000,
    // re-measure at the reshoot
    viewportHeight: 1090,
    hideTooltip: true,
    // THE STORY IS ONE BUBBLE READ IN BOTH PANELS (review: "what is the
    // 'story'?"). s1278 is 5.8 kb of K12 and s2272 is CFT073's 8.6 kb allele
    // of the same stretch: the blue boxes pair the one segment across the
    // panels, and the ring marks the allele the linear lane cannot draw.
    annotations: [
      {
        type: 'box',
        color: SAME_SEGMENT_COLOR,
        strokeWidth: 3,
        pad: 11,
        anchor: {
          view: 0,
          trackId: ECOLI_SEGMENTS_TRACK,
          loc: 'chr:4,063,561-4,069,329',
          fracY: 0.1,
        },
      },
      {
        type: 'box',
        color: SAME_SEGMENT_COLOR,
        strokeWidth: 3,
        pad: 8,
        anchor: { view: 1, graphNode: 's1278' },
      },
      {
        type: 'circle',
        anchor: { view: 1, graphNode: 's2272' },
        radius: 20,
        strokeWidth: 3,
      },
      {
        type: 'text',
        text: "CFT073's allele of the boxed segment has no K12 coordinates, so no block above",
        fontSize: 15,
        maxWidth: 260,
        leader: true,
        anchor: { view: 1, graphNode: 's2272' },
        dx: -90,
        dy: 40,
      },
    ],
  },
  // The paa island as a bubble — the graph answer to the all-vs-all synteny
  // figure, on the same locus (the comment above PAA_RAMP_DOMAIN records the two
  // indexes it was read off). Force-directed, because what a reader is being shown is the
  // SHAPE: one long backbone node with the rest of the graph looping past it.
  // An anchored layout draws that loop flat against the backbone it replaces,
  // which is the same drawing problem deletions have everywhere in these
  // figures.
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
          // `gfatools view -R … -r 1` walks the graph itself; a graph track's
          // cut walks coordinate intervals (`subgraphContext`), which at 1 hop
          // does close all four of this bubble's detours but also brings
          // flanking backbone the file leaves out. See
          // scripts/build_ecoli_pangenome_graph.sh, which writes this file.
          gfaLocation: { uri: `${DATA}/ecoli_paa_subgraph.gfa` },
          layoutMode: 'force',
          color: {
            field: 'position',
            domainMin: PAA_RAMP_DOMAIN.start,
            domainMax: PAA_RAMP_DOMAIN.end,
          },
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
          // No halo labels (review: "calling things a deletion in the graph is
          // somewhat confusing because its always 'relative to what'"): the
          // island is the ringed node and the synteny rows above, so the label
          // named it a second time, from K12's side only.
          layers: { bubbles: false },
        },
      ],
    }),
    readySelector: GRAPH_VIEW_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    viewportWidth: 1000,
    // the three strain rows (a gene lane each, and the segments lane on K12),
    // the two ribbon bands and the graph pane, all three shorter than the 1580
    // this started at. Measured off the run's own CONTENT CLIPPED BELOW THE
    // FOLD rather than guessed, and it follows `paneHeight` above rather than
    // driving it: the pane is the graph's, so shortening the capture alone
    // clips the bubble instead of scaling it.
    viewportHeight: 1190,
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
          trackId: ECOLI_SEGMENTS_TRACK,
          loc: `chr:${PAA_ISLAND_HIGHLIGHT.start}-${PAA_ISLAND_HIGHLIGHT.end}`,
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
      // s1613 is one of the off-reference nodes (SR:i:1 in
      // ecoli_paa_subgraph.gfa): the routes past the island carry their own
      // donor's coordinates, so the K12 ramp leaves them grey.
      {
        type: 'text',
        text: 'grey: the routes past the island',
        fontSize: 18,
        leader: true,
        anchor: { view: 1, graphNode: 's1613' },
        dx: 150,
        dy: 100,
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
  // `gfa-to-tabix paths` -- and doing that honestly needs each sample's
  // per-bubble contig coordinates chained across the gap, since "no bubble
  // here" is a statement about the graph and not evidence that a given sample
  // aligned there. That is a rebuild and a re-upload of the hosted demo BED,
  // and it was declined.

  // The linear -> graph direction of the round trip: the segments lane turned
  // into the graph from its own track menu. Two frames, because the menu is
  // reachable only through the UI: the cascade with the rows the actions take
  // boxed, then the graph the lane became, force-directed (review, on an
  // anchored frame: "this should be bandage graph. the linear backbone is just
  // confusing").
  {
    mode: 'url',
    name: 'pangenome/rgfa_segment_neighbourhood',
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          // the other direction of the round trip this is now composed into;
          // see the matching displayName on rgfa_strain_launch's view
          displayName: 'Linear genome view → graph',
          assembly: 'K12',
          loc: SEGMENT_WINDOW,
          tracks: [
            { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 110 },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              color: referencePositionColor(SEGMENT_REGION),
            },
          ],
        },
      ],
    }),
    readyText: SEGMENT_LABEL,
    readyTimeout: 90000,
    viewportWidth: 1000,
    // enough for the linear view plus the open track menu
    viewportHeight: 670,
    hideTooltip: true,
    actions: [
      trackMenuIcon(ECOLI_SEGMENTS_TRACK),
      ...menuCascade(['Display types', 'Graph']),
    ],
    stages: [
      { annotations: cascadeBoxes(['Display types', 'Graph']) },
      {
        // the gene lane over a force drawing at the display's 300 px default;
        // re-measure at the reshoot
        viewportHeight: 680,
        closeMenusAfter: true,
        actions: [
          {
            type: 'click',
            selector: '[data-testid="cascading-menuitem-graph"]',
          },
          { type: 'waitForSelector', selector: GRAPH_DRAWN },
          ...graphTrackMenu(ECOLI_SEGMENTS_TRACK, [
            'Layout: Anchored',
            'Force-directed layout',
          ]),
          {
            type: 'waitForSelector',
            selector: `${GRAPH_DRAWN}[data-layout="force"]`,
          },
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
  // linear->graph)").
  //
  // Each half is a two-stage capture (menu, then result), so composing the two
  // horizontally IS the 2x2: left column graph -> linear, right column linear
  // -> graph, each column reading down from the click to what it opened. The
  // direction is in each half's own view header rather than in a callout, see
  // the `displayName`s.
  //
  // The two halves are colored differently on purpose and the caption says so:
  // stable rank on the left, because the question there is WHOSE sequence the
  // arm is, and the reference-position ramp on the right, because the question
  // there is WHERE the segments are.
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
    readySelector: GRAPH_DRAWN,
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the gene and MAF lanes over the graph track capped at 420; re-measure at
    // the reshoot
    viewportHeight: 920,
    // The graph's own hover tooltip stays: it names the node and gives the
    // coordinates on the assembly that contributed it, which is the other half
    // of the correspondence the band shows. spec.hideTooltip does not reach it;
    // that only hides core's BaseTooltip.
    actions: [
      { type: 'delay', ms: 3000 },
      { type: 'hover', anchor: { graphNode: HOVERED_ALLELE } },
      {
        type: 'waitForSelector',
        selector: '[data-testid="graph-node-highlight"]',
      },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { graphNode: HOVERED_ALLELE },
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
        text: 'the ringed node is sequence only CFT073 has',
        anchor: { graphNode: HOVERED_ALLELE },
        dx: 300,
        dy: -60,
        maxWidth: 230,
        fontSize: 16,
      },
      // The band's K12 span IS two graph nodes, s403 and s404 (teal in both
      // panels), and review read the teal highlight above and the grey ring
      // below as two different things ("the ringed node is grey loop"). The
      // blue box and the blue pill pair them: the loop leaves at one end of
      // that span and rejoins at the other.
      {
        type: 'box',
        color: SAME_SEGMENT_COLOR,
        strokeWidth: 3,
        pad: 8,
        anchor: { graphNode: 's403' },
        fromAnchor: { graphNode: 's404' },
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
        text: "the K12 span between the insert's two ends",
        color: SAME_SEGMENT_COLOR,
        // Right edge against the band's LEFT edge, so the pill sits beside the
        // band rather than starting at its midpoint and running off to the
        // right of it — which is what a bare locus anchor does, since textAlign
        // only offers start and end and the pill's width is not known here.
        textAlign: 'end',
        anchor: {
          trackId: 'K12_genes',
          loc: 'chr:1,095,502-1,097,564',
          alignX: 'left',
          fracY: 0,
          dx: -6,
          dy: -16,
        },
        fontSize: 16,
      },
    ],
  },
  // The insertion rgfa_hover_sync rings, from wfmash's all-vs-all alignment
  // rather than the graph's index. Each window is a PAF chain end plus ~12 kb of
  // flank (`tabix ecoli_pggb_ava.pif.gz 'tK12#1#chr:1050000-1150000'`: K12
  // 887,944-1,094,152 <-> CFT073 942,350-1,127,332 and K12 1,097,432-1,183,704
  // <-> CFT073 1,241,061-1,327,893), so the frame edges map onto each other.
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
    // wider than the 1000 the tighter crop used: 5x more CFT073 in frame at the
    // same 1000 px would have cost the gene lane its labels, which the caption
    // reads the cluster's names out of
    viewportWidth: 1400,
    viewportHeight: 612,
    hideTooltip: true,
    annotations: [
      {
        type: 'text',
        text: 'sequence only CFT073 has',
        fontSize: 18,
        anchor: {
          view: [0, 1],
          trackId: 'CFT073_genes',
          loc: 'chr:1,127,332-1,241,061',
          fracY: 0,
          dy: -70,
        },
      },
      {
        type: 'text',
        text: 'insertion site in K12',
        fontSize: 18,
        leader: true,
        anchor: {
          view: [0, 0],
          trackId: 'K12_genes',
          loc: 'chr:1,095,502-1,097,564',
          fracY: 1,
        },
        dx: 60,
        dy: 70,
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
  // useful"). This figure takes the synteny entry — the one that makes the whole
  // claim at once: five panels, each already at that strain's own locus, from the
  // segments' SN/SO tags with nothing looked up in an alignment first. The
  // per-strain route is a node's own menu and gets its own figure
  // (rgfa_strain_launch).
  //
  // A standalone graph view, because this Launch menu is the view's: a graph
  // track's menu carries no synteny launch.
  //
  // The clicked rows are boxed and the second frame drops the graph pane, both
  // straight out of review: a cascade with nothing marked is a picture of a menu,
  // and a result frame that still carries the view it was launched from spends
  // half its height restating the frame above.
  {
    mode: 'url',
    name: 'pangenome/rgfa_launch_out_menu',
    url: LAUNCH_OUT_URL,
    readySelector: GRAPH_VIEW_READY,
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 580,
    hideTooltip: true,
    stages: [
      {
        viewportHeight: 580,
        actions: [
          {
            type: 'click',
            selector: `${LAUNCH_OUT_VIEW} [data-testid="view_menu_icon"]`,
          },
          { type: 'click', text: 'Launch' },
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
          { type: 'box', anchor: { text: 'Launch' } },
          { type: 'box', anchor: { text: 'Linear synteny view' } },
        ],
      },
      {
        // Reloaded at its own height, since the synteny click launched nothing
        // at the first frame's height (below ~430)
        url: LAUNCH_OUT_URL,
        viewportHeight: 930,
        actions: [
          {
            type: 'click',
            selector: `${LAUNCH_OUT_VIEW} [data-testid="view_menu_icon"]`,
          },
          { type: 'click', text: 'Launch' },
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
          // Curves, see-through indels and Follow (review: "use showCurves and
          // transparent indels maybe, and even 'follow' so that it aligns to
          // the top row better"): each strain opens framed on its own locus,
          // and Follow moves the four lower rows onto what aligns to K12's
          // window, so the ribbons run top to bottom instead of fanning out.
          {
            type: 'click',
            selector: '[aria-label="Synteny display settings"]',
          },
          { type: 'hover', text: 'CIGAR indels' },
          { type: 'click', text: 'Transparent indels' },
          { type: 'click', text: 'Curved lines' },
          { type: 'press', key: 'Escape' },
          { type: 'waitForText', text: 'Curved lines', hidden: true },
          {
            type: 'click',
            selector: '[data-testid="follow-synteny-toggle"]',
          },
          {
            type: 'waitForSelector',
            selector: displayPainted('synteny_canvas'),
            timeout: 120000,
          },
          { type: 'delay', ms: 8000 },
        ],
      },
    ],
  },
  // Out of the graph and into the strain that carries an arm, which is what
  // makes the graph's claim checkable: the graph says CFT073 carries 58,692 bp
  // at K12's asnW/asnU/asnV tRNA cluster that the reference does not, and the
  // node's `Open in CFT073` opens that sequence on CFT073's own coordinates,
  // where it is the colibactin (pks) island — clbA to clbS, the genotoxin
  // operon, in a strain isolated from a pyelonephritis patient.
  //
  // Two frames (review: "i dont see the workflow here. menu items that are
  // clicked need to be shown and boxed in red"): the node menu with the row the
  // actions take boxed, then the view it opens. Frame two closes the K12 view
  // once the launch has happened, so the frame is what it opened. The launched
  // panel carries CFT073's gene track because the launch brings the session's
  // annotation for the assembly it opens on.
  {
    mode: 'url',
    name: 'pangenome/rgfa_strain_launch',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      views: [
        {
          // pinned so the close click scopes to this view rather than to the
          // one the launch adds below it
          id: 'pks_graph',
          type: 'LinearGenomeView',
          // WHICH DIRECTION THIS HALF IS, in the app's own title bar rather
          // than as a fifth red rectangle over the drawing: this figure and
          // rgfa_segment_neighbourhood are the two directions of one round
          // trip, composed side by side (review: "consider combining into a
          // side by side 4-part image, clearly saying that it is shared (e.g.
          // graph ->linear, linear->graph)").
          displayName: 'Graph → linear genome view',
          assembly: 'K12',
          loc: regionLoc(PKS_REGION),
          tracks: [
            // Stable rank puts K12's rank-0 backbone in one hue and CFT073's
            // rank-2 segments in another, and the cut is held to the window
            // (see PKS_REGION).
            graphTrack(ECOLI_SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              color: { field: 'rank' },
              maxRegionBp: cutNear(PKS_REGION),
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the taller frame, the force drawing plus the node menu; re-measure at the
    // reshoot
    viewportHeight: 820,
    hideTooltip: true,
    stages: [
      {
        // This is also the height stage two ACTS at (a stage resizes after its
        // own actions), so it has to hold the launched view long enough for its
        // gene track to draw as well.
        viewportHeight: 820,
        actions: [
          { type: 'rightclick', anchor: { graphNode: 's2132' } },
          { type: 'waitForText', text: 'Open in CFT073' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Open in CFT073' } },
          // WHICH node the menu is open on, in three words (review: "it has
          // text annotation on the graph and the menu items. that is too
          // much"). s2132 is CFT073#1#chr:2,258,597 +58,610 bp; anchored by
          // node NAME, so it follows the FMMM layout.
          {
            type: 'text',
            text: 'CFT073 only',
            fontSize: 17,
            anchor: { graphNode: 's2132' },
            dy: -70,
          },
        ],
      },
      {
        // Re-opened rather than clicked out of the menu stage one left
        // standing: the resize between the two stages moves the menu under it.
        closeMenusFirst: true,
        // the launched view alone, once the K12 view has gone
        viewportHeight: 330,
        actions: [
          { type: 'rightclick', anchor: { graphNode: 's2132' } },
          { type: 'waitForText', text: 'Open in CFT073' },
          { type: 'click', text: 'Open in CFT073' },
          { type: 'delay', ms: 3000 },
          {
            type: 'click',
            selector: `${PKS_VIEW} [data-testid="close_view"]`,
          },
          // a gene of the island itself, so the wait cannot pass on a view that
          // opened empty. clbK is 6.5 kb, the widest of them, so its label is
          // the first to render.
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
