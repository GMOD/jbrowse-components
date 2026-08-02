import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { ECOLI_DEMO_BASE, usingLocalDemo } from './demoBase.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

// The url the tracked fixture configs hardcode, and what ECOLI_DEMO_BASE
// replaces in them when it is set.
const HOSTED_DEMO = 'https://jbrowse.org/demos/ecoli_pangenome'

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
//
// The sibling is WRITTEN here rather than kept by hand, because a gitignored
// copy of a tracked config drifts and nothing notices: `hprc_local.json` was
// made before the two CFHR gene tracks were added to `hprc.json`, so under
// GRAPH_PLUGIN_LOCAL those tracks were simply absent and
// `pangenome/hprc_cfhr_deletion` failed on annotation anchors that resolved to
// nothing. That reads as a regression in whatever you are testing, which is the
// worst possible failure for the one switch you flip only when hunting one.
const localEsmUrl =
  '/test_data/graphgenomeview/_localdist/jbrowse-plugin-graphgenomeviewer.esm.js'
// Repo root, off this module rather than off cwd: the spec paths are stated
// relative to the root and this file is imported by more than the generator.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
// The fixture configs also hardcode the hosted demo's data urls, so ECOLI_DEMO_BASE
// has to rewrite them here too — otherwise a local-demo run renders the new
// plugin against the OLD hosted files. Same gitignored-sibling mechanism, and it
// writes the sibling rather than keeping one by hand for the same reason: a
// hand-kept copy of a tracked config drifts and nothing notices.
const rewriteFixture = usingLocalDemo || process.env.GRAPH_PLUGIN_LOCAL
const local = rewriteFixture
  ? (name: string) => {
      const derived = name.replace(/\.json$/, '_local.json')
      let text = readFileSync(`${repoRoot}${name}`, 'utf8')
      if (usingLocalDemo) {
        text = text.replaceAll(HOSTED_DEMO, ECOLI_DEMO_BASE)
      }
      const config = JSON.parse(text) as { plugins: { esmUrl: string }[] }
      if (process.env.GRAPH_PLUGIN_LOCAL) {
        for (const plugin of config.plugins) {
          plugin.esmUrl = localEsmUrl
        }
      }
      writeFileSync(
        `${repoRoot}${derived}`,
        `${JSON.stringify(config, null, 2)}\n`,
      )
      return derived
    }
  : (name: string) => name
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
// 100 kb, zoomed out per review from the 50 kb this used to draw. At 50 kb the
// Sakai band arrived in the last 4% of the row and the rest of it was white,
// which reads as a row with no data rather than as a strain that lacks the
// island; at 100 kb its block is half the row and the island is visibly what it
// stops short of.
const PAA_SYNTENY_WINDOW = 'chr:1,420,000-1,520,000'
const PAA_NCTC86_WINDOW = 'chr:1,683,100-1,784,700'
const PAA_SAKAI_WINDOW = 'chr:1,932,400-2,038,800'
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
    showDescriptions: false,
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

// The two haplotypes hprc_cfhr_deletion draws against hg38: hap 1 of HG01109,
// which is homozygous for the 84.7 kb deletion, and hap 1 of HG00099, which is
// homozygous reference. A haplotype carries an allele; only the sample it comes
// from can be homozygous for one, and both of these were picked out of the
// callset on the sample's genotype (scripts/build_hprc_cfhr_synteny.sh), so the
// drawn row is one of two identical haplotypes either way. Their alignments to
// GRCh38 come out of HPRC's own
// impg/pafs/hprc465vsgrch38.aln.paf.gz, sliced to this window by
// scripts/build_hprc_cfhr_synteny.sh -- one record for the non-carrier running
// straight through, two for the carrier with the deleted span between them.
//
// The per-row windows are the reference window carried across each haplotype's
// own record by offset, which is the arithmetic the PAF's four coordinate columns
// state directly. Indels inside the alignment make that approximate at the scale
// of hundreds of bp over half a megabase, which nothing here can see: the rows
// are 200 kb and 125 kb wide, and the synteny view draws the ribbons from the
// alignment itself rather than from these numbers.
const CFHR_CARRIER = 'HG01109.1'
const CFHR_CARRIER_TRACK = 'hprc_cfhr_synteny_HG01109_1'
const CFHR_CARRIER_GENES = 'hprc_cfhr_genes_HG01109_1'
const CFHR_CARRIER_WINDOW = 'JAHEPA020000055.1:49,360,000-49,485,000'
const CFHR_NONCARRIER = 'HG00099.1'
const CFHR_NONCARRIER_TRACK = 'hprc_cfhr_synteny_HG00099_1'
const CFHR_NONCARRIER_GENES = 'hprc_cfhr_genes_HG00099_1'
const CFHR_NONCARRIER_WINDOW = 'JBHDWO010000059.1:61,620,000-61,822,000'
const CFHR_REGION = {
  refName: 'chr1',
  assemblyName: 'hg38',
  start: 196700000,
  end: 196900000,
}
// The deleted span, from the allele inventory's own row (-84,683 at this
// position), used both as the in-app highlight and as the box that names what is
// inside it, so the two cannot part company.
const CFHR_DELETED = { refName: 'chr1', start: 196753088, end: 196837771 }
const CFHR_DELETED_LOCUS = `chr1:${CFHR_DELETED.start + 1}-${CFHR_DELETED.end}`

// The inversion figure, at 1q21.1. `hprc-v2.0-mc-grch38.bubbles.bed.gz` flags
// this bubble as an inversion (246 of its 130,510 rows carry that column), and
// the links index states the breakpoints as three mixed-orientation rank-0
// links, bracketing chr1:144,419,292-144,572,458.
//
// The flag alone is not the finding, which is why this figure exists at all:
// gfatools cannot tell a polymorphic inversion from an inverted paralog, 1q21.1
// is a segmental duplication, and the wave VCF never sets its own INV flag here.
// scripts/build_hprc_inversion_synteny.sh settles it against HPRC's published
// all-vs-GRCh38 PAF, classifying every haplotype by TWO orientations -- the
// bubble's, and the sequence outside it -- because a haplotype whose whole
// window is reverse says nothing (its contig may be deposited that way). 64
// haplotypes reverse the bubble with forward flanks and 23 keep it forward; the
// script prints both counts, so the split is its output rather than prose.
//
// It also picks the panel, and NOT on record counts, which was the first attempt
// and put a crossed ribbon on the non-carrier row. Every haplotype in this window
// carries inverted paralogs -- 1q21.1 is a segmental duplication -- and each of
// those draws the same crossing the inversion does. What decides whether one is
// drawn is not the frame: a level fetches its QUERY axis's visible window widened
// by `syntenyPanBufferPx` (2000 px of bp per side here, 700 kb, snapped to that
// grid) and leaves the mate axis unscoped, so a 1.2 Mb slice is fetched whole and
// a mate a megabase off the other row still draws. So the script cuts each
// emitted PAF to the frame below and keeps only haplotypes whose in-frame records
// are the inversion plus forward flanks (31 of 64 carriers, 12 of 23
// non-carriers). The two windows below are its output, not measurements.
const INV_CARRIER = 'HG01891.1'
const INV_CARRIER_TRACK = 'hprc_inv_synteny_HG01891_1'
const INV_NONCARRIER = 'HG02698.2'
const INV_NONCARRIER_TRACK = 'hprc_inv_synteny_HG02698_2'
// Each row's own window: the span its in-frame records cover on that haplotype.
const INV_CARRIER_WINDOW = 'JAGYVO020000062.1:6,437,000-6,868,942'
const INV_NONCARRIER_WINDOW = 'JBHDTM010000033.1:3,912,000-4,309,991'
// The drawn reference window, and the frame the script selects against. Its right
// edge stops short of 144,610,000 because past there most haplotypes carry a
// paralogous record of their own.
const INV_WINDOW = 'chr1:144,260,000-144,610,000'
const INV_REGION = {
  refName: 'chr1',
  assemblyName: 'hg38',
  start: 144260000,
  end: 144610000,
}
const INV_BLOCK = { refName: 'chr1', start: 144419292, end: 144572458 }
const INV_BLOCK_LOCUS = `chr1:${INV_BLOCK.start + 1}-${INV_BLOCK.end}`

// The left edge of a window, as a point locus: what a row label anchors to, so
// the callout sits at the start of the row it names instead of at a measured x.
const windowStart = (loc: string) => loc.split('-')[0]!

// The CHM13 figure, at 17q25.3. Every other haplotype in this graph names contigs
// by GenBank accession and is not a loadable assembly, so a donor node's
// right-click menu has nothing to open. CHM13 is the exception: it is in the graph
// as a contributor (rank 61, added after 60 haplotypes, so it is credited with
// little), it spells its contigs `chr17`, and T2T-CHM13v2.0 is hosted at UCSC. So
// this is the one HPRC window where the graph's own sequence can be opened on the
// assembly that contributed it.
//
// The node is the largest CHM13-only segment in the graph that touches GRCh38 at
// all, found by scanning `tabix links.bed.gz CHM13#0#chr<n>` for rows with a
// GRCh38 endpoint: 142,227 bp of CHM13 chr17 hanging off a 75 bp GRCh38 anchor,
// one link in and one link out. Subtelomeric, which is where T2T has sequence and
// GRCh38 has none.
const CHM13_WINDOW = 'chr17:83,010,000-83,040,000'
const CHM13_REGION = {
  refName: 'chr17',
  assemblyName: 'hg38',
  start: 83010000,
  end: 83040000,
}
const CHM13_NODE = 's504955'
// The bubble the node is the long allele of: 34 segments over a 1,023 bp
// reference span, longest allele 146,023 bp (`tabix bubbles.bed.gz
// 'GRCh38#0#chr17:83,022,000-83,024,000'`).
const CHM13_BUBBLE = { refName: 'chr17', start: 83022357, end: 83023380 }
// The node's own span on CHM13, from its `SN`/`SO` tags, padded to a round window.
const CHM13_ALLELE = { refName: 'chr17', start: 83899576, end: 84041803 }
const CHM13_ALLELE_WINDOW = 'chr17:83,880,000-84,060,000'

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

// The one event pangenome/hprc_graph_vs_callset marks in both products: a
// 14,596 bp deletion, the largest record in the window that more than one donor
// carries. From the callset itself —
// `tabix hprc-v2.0-mc-grch38.wave.vcf.gz chr6:32510000-32600000`, longest REF
// among the records the SV filter keeps.
const MHC_MARKED_DELETION = '6:32,514,842-32,529,438'

// The linear half of the graph view's 'Reference position' color scheme, which
// is the answer to "if the nodes were rainbow colored in exact same way in
// lineargenomeview and bandage graph it might help show correspondence".
//
// That scheme is a hue ramp over the region the subgraph was cut from: hue 0
// (red) at its start to 300 (magenta) at its end, at saturation 70% and
// lightness 50% (jbrowse-plugin-graphgenomeview renderer/GeometryBuilder.ts,
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
// the same. `showLabels: 'none'`: the ids are the graph's own `s101124`
// counters, which name nothing a reader can look up, and at these widths the
// display spends three or four rows of text on them — in the 90 kb
// allele-inventory frame they covered more area than the blocks did. What the
// lane is for is the blue rank-0 backbone tiling the reference. 'none' rather
// than the legacy 'off', which migrateBasicConfigSnapshot folds onto
// 'description' (names hidden, descriptions still drawn if the adapter emits
// any) rather than onto no labels at all.
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
    showLabels: 'none',
    heightMode: 'grow',
    color: referencePositionColor(domain),
  }
}

// A haplotype row's own genes: HPRC's CAT annotation of that assembly, sliced to
// the window by scripts/build_hprc_cfhr_synteny.sh. Same glyph settings as the
// hg38 lane between them, so the three rows are read the same way and the
// missing genes are missing rather than differently drawn.
function cfhrGeneLane(trackId: string) {
  return {
    trackId,
    type: 'LinearBasicDisplay',
    geneGlyphMode: 'longestCoding',
    displayMode: 'compact',
    height: 70,
  }
}

// The structural tier of the wave VCF, which is what makes it comparable to the
// graph: minigraph collapses everything under ~50 bp, so an unfiltered callset
// is thousands of SNP columns the graph never had. `alleleLength` rather than
// end-start because an insertion consumes no reference and a span filter would
// keep only deletions. LV==0 drops the nested children vcfwave's decomposition
// writes beside their parents, which would otherwise put one event in two
// columns. Same filter the hprc2 matrix figures use.
const SV_FILTER = ['jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50']

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

function pggbLocusSession(
  layoutMode: 'force' | 'samplerows',
  { region, window }: { region: typeof PGGB_LOCUS; window: string },
) {
  return sessionSpec(CONFIG, {
    sessionTracks: [
      K12_GENES_SESSION_TRACK,
      PGGB_SEGMENTS_SESSION_TRACK,
      ...(layoutMode === 'samplerows' ? [PGGB_MAF_SESSION_TRACK] : []),
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: window,
        tracks: [
          { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
          ...(layoutMode === 'samplerows'
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
//
// Both halves box THE SAME TWO NODES and say which setting they are (review: "I
// don't particularly understand the difference here. ideally, shows red boxes
// and arrow and/or text annotation showing the difference between the two
// sides"). Without that, the difference is stated only as a node count in a
// header over two FMMM tangles that share no visible landmark, so the reader has
// nothing to compare. Boxed on their ids rather than their positions, so the two
// layouts can put them wherever they like:
//
// - s2093 (43 bp) and s2095 (558 bp) are where one CFT073 detour leaves the
//   backbone and rejoins it. At None they are the two loose ends. At 1 hop the
//   same two boxes are the two sides of a closed bubble.
// - s2094 (5.5 kb) is that detour's interior. It sits on CFT073's own contig, so
//   no K12 coordinate names it and the region query cannot reach it. It is what
//   the hop adds, and the arrow in that half points at it.
//
// The hop reaches five other segments too, which is why the right half still has
// loose ends: one step out lands on a new frontier (s2092, s2387, s2633), and two
// of the five are rank 0 reference either side of the window (s499, s508).
function graphContextPartSpecs(): ScreenshotSpec[] {
  const DETOUR_ENTRY = 's2093+'
  const DETOUR_EXIT = 's2095+'
  const DETOUR_INTERIOR = 's2094+'
  // The label sits in the graph pane's own top-right, which is empty in both
  // layouts, anchored on the canvas the graph draws into. NOT on the node-count
  // readout beside it, which was the first thing tried: that element is text, so
  // its width and therefore its centre move with the numbers it happens to be
  // showing. `17 nodes, 21 edges` against `20 nodes, 25 edges` shifted the pill
  // and swung the arrow tail off the pane, which is a callout decalibrated by the
  // thing it is captioning. The canvas is sized by the viewport instead, and its
  // 13px height difference between the halves is the only thing dy inherits.
  //
  // maxWidth is what keeps the pill inside its own half of the composite: with
  // the pill's left edge at the canvas centre plus dx, the wrap has to leave room
  // for it inside the remaining ~260px.
  const canvasAnchor = { selector: '[data-testid="graph-genome-canvas"]' }
  const label = (text: string): Annotation => ({
    type: 'text',
    text,
    anchor: canvasAnchor,
    dx: 110,
    dy: -278,
    maxWidth: 205,
    fontSize: 18,
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
              showDescriptions: false,
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
          bubbleSpread: 'open',
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
      ...[DETOUR_ENTRY, DETOUR_EXIT].map(
        (graphNode): Annotation => ({
          type: 'box',
          anchor: { view: 1, graphNode },
          strokeWidth: 3,
          // clear of the node's own "43 bp" / "558 bp" label, which the graph
          // writes across the node rather than inside its bounding box
          pad: 22,
        }),
      ),
      label(text),
      // the arrow only exists in the half that has an interior to point at
      ...(subgraphContext > 0
        ? [
            {
              type: 'arrow',
              anchor: { view: 1, graphNode: DETOUR_INTERIOR },
              // out of the pill's lower left corner, which is where the label
              // above puts it
              fromAnchor: { ...canvasAnchor, dx: 160, dy: -206 },
              strokeWidth: 3,
            } satisfies Annotation,
          ]
        : []),
    ],
  })
  return [
    part(
      'pangenome/graph_context_none',
      0,
      'Graph context: None\nthe boxed ends stop in mid-air',
    ),
    part(
      'pangenome/graph_context_hop1',
      1,
      'Graph context: 1 hop\nthe interior arrives, closing the bubble',
    ),
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

// The two landmark nodes both halves circle, so the pair states its own
// correspondence instead of asserting it in a caption (review: "IDEALLY this
// would even circle things in the backbone view that match the force directed
// bandage view"). One reference node and the longest allele over it, picked off
// `probe-graph-nodes.ts pangenome/hprc_mhc_layout_force` rather than by eye:
//
//   s101145+  12,021 bp  rank 0, GRCh38#0#chr6:32,517,416
//   s396436+  12,253 bp  rank 5, HG00738.2#2#CM086684.1:32,492,010
//
// They are the two longest nodes in the cut, so the graph writes `12 kb` and
// `12.3 kb` beside them in both layouts and the rings do not have to carry the
// identification themselves. Anchored by id, so each layout can put them where
// it likes.
const MHC_LANDMARK_NODES = ['s101145+', 's396436+']

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
// What the LINEAR half shows, which is not the cut (review: "i see there is an
// answer but i dont get it. we may want to zoom out more"). The one-hop cut
// reaches s692 and s694, the backbone segments either side of the 4.4 kb s693
// the window sits inside, and s694 runs to 2,139,486 — so on an LGV of the cut
// itself the biggest node in the minigraph pane was a segment the reader could
// not see anywhere else in the frame, and a label saying so is not the same as
// showing it. This span is the minigraph cut's own extent, so every node in that
// pane is a block in the lane above it at the same colour, and the window is
// banded on the ruler.
//
// The two halves are read off this lane differently, and that is the figure
// rather than a flaw in it. The minigraph pane's seven segments spread across
// the whole 20.8 kb, one hue each. The pggb pane's fifty-three all sit inside the
// banded 300 bp, so they come out one hue: the whole pane is that sliver of the
// lane, which is the resolution claim stated in colour. It also lets the alleles
// carry the pane, since a segment with no reference coordinate of its own draws
// grey and those are now the only nodes that differ from their neighbours.
const RESOLUTION_LANE_DOMAIN = { start: 2118646, end: 2139486 }
const RESOLUTION_LANE_WINDOW = 'chr:2,118,646-2,139,486'

// The one node in the minigraph half that is not what it looks like, and the
// review it drew: "unclear where that pink node in the minigraph rgfa is
// connected to?". It is s694, K12 chr:2,123,069-2,139,486 (rank 0 in
// `ecoli_minigraph.segs.bed.gz`) — the reference backbone segment immediately
// downstream, brought in by the one-hop cut off the 4.4 kb s693 the window sits
// inside, and painted at the magenta end of the reference-position ramp because
// it starts past the loaded 3 kb. So it reads as a giant off-reference allele
// while being neither off-reference nor inside the window. It joins s693 at the
// window's right edge and its far end is loose because its other neighbour,
// s695, is outside the cut.
//
// The cut reaches the backbone on both sides — s692 is the 33 bp red node at
// the ramp's other end — but only this one is big enough to dominate the pane,
// so only this one is labelled. The caption names the pair.
const RESOLUTION_BACKBONE_NODE = 's694'

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
    layoutQuality = 1,
  }: {
    name: string
    trackId: string
    sessionTrack: object
    label: string
    labelOffset: { dx: number; dy: number }
    extraAnnotations?: Annotation[]
    bubbleSpread?: 'auto' | 'open' | 'wide' | 'compress'
    layoutQuality?: number
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
          // the 3 kb that was actually cut, banded on the ruler so the lane
          // says which slice of itself the pane below it is
          highlight: [{ ...RESOLUTION_REGION, refName: 'chr' }],
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
          loadedRegion: RESOLUTION_REGION,
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
      trackId: ECOLI_SEGMENTS_TRACK,
      sessionTrack: ECOLI_SEGMENTS_SESSION_TRACK,
      label: 'minigraph rGFA\nstructural variation only',
      labelOffset: { dx: -340, dy: -260 },
      // What RESOLUTION_BACKBONE_NODE is, anchored by segment id through the
      // view's own nodePositions so FMMM can put it wherever it likes.
      //
      // The arrow onto s693 that used to be here is gone with the proportional
      // drawn length that made it necessary: at that scale s694 arced right
      // across the pane and its junction was in a corner, so the junction had to
      // be pointed at. Compressed, the two are collinear and meet at a visible
      // vertex, which an arrow drawn between their midpoints would run straight
      // down the top of.
      extraAnnotations: [
        {
          type: 'text',
          // Names the node and answers its one loose end in the same pill
          // (review: "the teal node just doesnt connect to anything ... users
          // will not understand this if this is just a jbrowse limitation of our
          // data fetching"). It is not a fetch that stopped short: s694 joins
          // s693 at the visible vertex below, and its other end is where the
          // loaded subgraph stops, which every cut of a graph has somewhere.
          text: 'reference backbone (s694),\nthe cyan block above;\nits far end is the cut edge',
          anchor: { view: 1, graphNode: RESOLUTION_BACKBONE_NODE },
          // right off the node, into the open ground beside it: at the midpoint
          // itself the pill sits on the node it is naming, and to the left it
          // runs off the pane, since compressing the drawn lengths moved s694
          // from the middle of the drawing to its lower left corner
          dx: 150,
          dy: -10,
          maxWidth: 240,
          fontSize: 16,
        },
      ],
    }),
    part({
      name: 'pangenome/graph_resolution_pggb',
      trackId: PGGB_SEGMENTS_TRACK,
      sessionTrack: PGGB_SEGMENTS_SESSION_TRACK,
      label: 'pggb\na node at every variant',
      labelOffset: { dx: 110, dy: -250 },
    }),
  ]
}

function mhcLayoutPartSpecs(): ScreenshotSpec[] {
  const part = (
    name: string,
    layoutMode: 'auto' | 'force',
    viewportHeight: number,
    // Where the half's own caption sits, as an offset from the graph canvas
    // centre. The two layouts leave their whitespace in different places -- the
    // force drawing's nodes all sit below the top of its pane, the anchored one
    // fills its top rows and empties out under the low ranks -- so a single
    // offset would land on the drawing in one of them.
    labelOffset: { dx: number; dy: number },
    label: string,
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
    annotations: [
      ...MHC_LANDMARK_NODES.map(
        (graphNode): Annotation => ({
          type: 'circle',
          anchor: { view: 1, graphNode },
          radius: 24,
          strokeWidth: 3,
        }),
      ),
      {
        type: 'text',
        text: label,
        anchor: { selector: '[data-testid="graph-genome-canvas"]' },
        ...labelOffset,
        maxWidth: 300,
        fontSize: 20,
      },
    ],
  })
  return [
    // the top strip of the force pane: its nodes start well below the top of
    // the canvas, so nothing is covered there
    part(
      'pangenome/hprc_mhc_layout_force',
      'force',
      1055,
      {
        dx: -390,
        dy: -276,
      },
      'The same subgraph, force-directed',
    ),
    // the one-hop default cut brings in more nodes than the old None cut, so
    // the anchored pane grew past the 775 this used to need. Its label goes in
    // the block under the low-rank rows, which carry a label and almost no
    // nodes, and clear of the row labels' own column.
    part(
      'pangenome/hprc_mhc_layout_anchored',
      'auto',
      790,
      {
        dx: -310,
        dy: 46,
      },
      'The same subgraph, anchored on hg38',
    ),
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
  // what says they are consecutive rather than scattered. It is also what ties
  // the two panels together now the graph is force-directed rather than anchored
  // on the K12 path (review: "the backbone graphs are too hard to understand ...
  // across all our figures"): a block in the lane and its node in the graph are
  // the same hue at the same bp.
  {
    mode: 'url',
    name: 'pangenome/pggb_locus_graph',
    url: pggbLocusSession('force', {
      region: PGGB_LOCUS,
      window: PGGB_LOCUS_WINDOW,
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    settleMs: 5000,
    viewportWidth: 1000,
    // the two lanes plus the graph pane, which is about as tall as it is wide
    // for a force drawing where the anchored one was two rows
    viewportHeight: 1050,
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
    viewportHeight: 895,
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
  // It is deliberately the same locus pggb_locus_graph opens from the index,
  // because that is the section this one answers: the tabix cut rebuilds
  // segments and links only, so it has no P lines and this setting has nothing
  // to draw. The file route keeps them. Same bubble, two colourings — reference
  // position there, carriage here.
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
      views: [
        {
          type: 'GraphGenomeView',
          gfaLocation: { uri: `${DATA}/ecoli_pggb_is5.gfa` },
          layoutMode: 'force',
          layoutQuality: 4,
          // A floor, where the sibling graph figures compress, and the two are
          // not interchangeable. This one is about carriage rather than bubble
          // shape, and carriage is drawn on EDGES as one offset stroke per path:
          // the 1.2 kb deletion arc has to stay long for five ribbons to
          // separate along it and for the one magenta IAI39 stroke to be the
          // only thing on it. A floor lifts the 1 bp alleles and leaves that arc
          // proportional; 'compress' pulls it towards the mean and the five
          // strokes crowd into the colour pile-up drawPaths is prone to, which
          // states the opposite of what the figure is for. Rendered both.
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
    readySelector: `body:has([data-testid="graph-path-legend"]) [data-testid="graph-perf-stats"]`,
    readyTimeout: 90000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    // the force pane runs to its 600px cap here, and the five-row legend fits
    // inside it
    viewportHeight: 763,
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
          levelHeights: [150, 150],
          views: [
            {
              assembly: 'NCTC86',
              loc: PAA_NCTC86_WINDOW,
              tracks: [strainGeneLane('NCTC86_genes')],
            },
            {
              assembly: 'K12',
              loc: PAA_SYNTENY_WINDOW,
              highlight: [PAA_ISLAND_HIGHLIGHT],
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
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    // the three strain rows (a gene lane each, and the segments lane on K12),
    // the two ribbon bands and the graph pane
    viewportHeight: 1580,
    hideTooltip: true,
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
      // arrives in one uniform color; the colors the sibling figures were given
      // declaratively are a Color-dropdown step here, and the tutorials tell the
      // reader to take it. Driving it keeps the two halves of this
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
          // Rainbow rather than Stable rank, per review ("consider using rainbow
          // coloring for the segments?"). Rank is two colors on a 16-node
          // neighbourhood — reference and not — so the arms all painted alike and
          // the only thing telling one segment from the next was its length
          // label. Rainbow gives each segment its own hue, which is what makes
          // the chain readable as a sequence of distinct segments, and it is
          // Bandage's own default.
          { type: 'click', text: 'Rainbow' },
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
  // it is: an edge that leaves the backbone before CFHR3 and rejoins it after
  // CFHR1, with the reference the deletion skips running underneath.
  //
  // ANCHORED, NOT FORCE, and that is the whole answer to "does the bandage graph
  // intuitively show the deletion" (review). It did not, and the reason is
  // structural rather than a matter of taste: FMMM has no reference axis, so the
  // arc's two endpoints are wherever the simulation put them and its size is the
  // only thing left to carry the event. Two consequences were visible in the
  // force capture. The arc bowed out by the drawn length of the backbone it
  // bypasses (DELETION_BULGE_FRACTION), but that backbone was scattered across
  // the drawing, so the loop enclosed nothing; and the label rides an apex
  // computed from the *bypassed* nodes (graphLabels.ts deletionApex) while the
  // curve is drawn between the *edge's* endpoints, which in a force layout are
  // different places -- "skips 84.7 kb of reference" sat at the top right on the
  // magenta chain with the arc sweeping the opposite corner.
  //
  // Cross-referenced against ~/src/vendor, since the review asked: every tool
  // that shows a deletion legibly puts the reference on an axis first. VRPG
  // (lh3's rGFA viewer) projects the graph onto reference coordinates and sits it
  // beside a linear annotation panel, which is this pairing. sequenceTubeMap
  // orders nodes monotonically along x and gives each a width from its length, so
  // a path that skips nodes is drawn over the nodes it skips (drawDeletion in
  // tubemap.js is a grey line across exactly that span). odgi does not use a
  // node-link drawing for this at all: `odgi pav` / `odgi viz` reduce
  // presence/absence to a path-by-position matrix, where a deletion is a gap in
  // one row. Bandage itself has no reference concept, so a deletion there is a
  // bare link at a joint with nothing to state -- our bulge was already an
  // improvement on that, and it is as far as a force layout can go. PangyPlot is
  // the one force-directed pangenome viewer that does solve it, and it does the
  // inverse of what we do: the deletion link stays a straight chord with an x
  // drawn at its midpoint, and a dedicated force (delLinkForce in
  // layout-forces.js) pushes the bypassed nodes perpendicularly off it, so the
  // layout itself closes the bubble instead of the edge bowing to fake one.
  //
  // The step after this one, which is NOT taken: project the link index into a
  // LinearPairedArcDisplay track and drop the graph panel. Decided against, with
  // the three reasons in agent-docs/reference/PANGENOME_GRAPHS.md under Carriage
  // ("No linearized deletion track"). Short version: the arcs are anonymous, and
  // the wave VCF already states this event with a genotype per haplotype.
  //
  // On this window the anchored layout costs nothing and pays twice: the arc
  // spans exactly the bp it removes, and it spans them under the hg38 row of the
  // synteny view above, so the boxed CFHR3/CFHR1, the carrier's missing ribbon
  // and the arc all line up on the same coordinates. What it loses is the labels
  // on the other two deletions (2.2 kb and 9.3 kb): MIN_DELETION_LABEL_PX gates
  // on the arc's bulge in screen px, and at 0.4% zoom theirs is ~13 px, where in
  // FMMM units the same two cleared it. They are still drawn, as the short thick
  // arcs off the backbone, and the caption says so rather than naming a number
  // the figure cannot show.
  //
  // The linear panel is a synteny view of two real haplotypes rather than the
  // reference alone (review: "in the most ideal world, we would have a
  // linearsyntenyview showing this deletion along with the graph"). The graph
  // states the deletion as an arc, which is the graph's own vocabulary; the
  // synteny rows state it as one haplotype's alignment simply stopping and
  // resuming past CFHR1 while another's runs straight through. Two readings of
  // the same event, which is what the pairing is for.
  //
  // 41 nodes over 11 stable ranks, so the anchored layout is 11 rows deep. The
  // rank numbers here run to 458 and mean nothing to a reader on their own
  // (rank is minigraph's build order over the whole graph, not this window), but
  // rows are the ranks actually present, in order, so the depth is the number of
  // distinct alternatives and not the graph's rank ceiling.
  //
  // Carriers are picked from the callset, not by eye: at the wave VCF's
  // chr1:196,753,075 record the 1 bp ALT is the 84.7 kb deletion and 139 of the
  // 464 haplotypes carry it. HG01109 is homozygous for it and HG00099
  // homozygous reference (scripts/build_hprc_cfhr_synteny.sh prints both
  // counts), so the pair is a carrier and a non-carrier of the same event.
  {
    mode: 'url',
    name: 'pangenome/hprc_cfhr_deletion',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          // carrier above the reference and non-carrier below it, because
          // ribbons are drawn between neighbouring rows only: both bands are
          // then against hg38, which is the comparison.
          tracks: [[CFHR_CARRIER_TRACK], [CFHR_NONCARRIER_TRACK]],
          drawCurves: true,
          levelHeights: [110, 110],
          collapseEmptyRows: true,
          views: [
            {
              assembly: CFHR_CARRIER,
              loc: CFHR_CARRIER_WINDOW,
              tracks: [cfhrGeneLane(CFHR_CARRIER_GENES)],
            },
            {
              assembly: 'hg38',
              loc: CFHR_WINDOW,
              // The deleted span itself, from the allele inventory's own row, so
              // the band is drawn from the data rather than measured off the
              // picture. The carrier's ribbon is absent over it and the
              // non-carrier's runs through it, which is the figure in one look.
              // The ribbon gap is a little narrower than the band: the two
              // alignment records overlap by a few kb of breakpoint homology,
              // which is where the ribbons cross.
              highlight: [{ ...CFHR_DELETED, color: 'rgba(60,65,72,0.10)' }],
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
              assembly: CFHR_NONCARRIER,
              loc: CFHR_NONCARRIER_WINDOW,
              tracks: [cfhrGeneLane(CFHR_NONCARRIER_GENES)],
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: CFHR_REGION,
          layoutMode: 'auto',
          // Redundant with x now that x is a coordinate, kept because the
          // segments lane in the panel above is on the same ramp: a node and the
          // segment it came from share a color as well as a position.
          colorScheme: 'reference-position',
          // No bubbleSpread. It is a floor on a node's drawn length in FMMM
          // units, passed to the remote engine only (bandageAutoScale in
          // model.ts), so under a layout that runs locally from coordinates it
          // is dead, and leaving it in the session puts a click-path in the
          // figure's recipe that changes nothing.
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    // 1580 while the graph half was FMMM, whose drawing is squarer than 11 rows
    // of backbone: the anchored pane came out 238 px shorter
    viewportHeight: 1342,
    hideTooltip: true,
    // What the reader is looking at, named on the rows themselves (review: "can
    // red boxes and text annotation be added"). The box wraps the two genes the
    // deletion takes, on the reference lane where they are annotated; each
    // haplotype label sits at the left edge of its own gene lane, anchored to the
    // row's window start rather than to a measured x.
    annotations: [
      {
        type: 'box',
        anchor: {
          view: [0, 1],
          track: 'hg38_ncbiRefSeq_ucsc',
          locus: CFHR_DELETED_LOCUS,
        },
      },
      {
        type: 'text',
        fontSize: 17,
        maxWidth: 480,
        anchor: {
          view: [0, 0],
          track: CFHR_CARRIER_GENES,
          locus: windowStart(CFHR_CARRIER_WINDOW),
          fracY: 1,
          dx: 14,
          dy: -24,
        },
        text: 'HG01109 hap1: no CFHR3, no CFHR1',
      },
      {
        type: 'text',
        fontSize: 17,
        maxWidth: 480,
        anchor: {
          view: [0, 2],
          track: CFHR_NONCARRIER_GENES,
          locus: windowStart(CFHR_NONCARRIER_WINDOW),
          fracY: 1,
          dx: 14,
          dy: -24,
        },
        text: 'HG00099 hap1: both present',
      },
    ],
  },
  // The inversion figure. Insertions are nodes and deletions are edges, and the
  // tutorial drew both; an inversion is neither, and until this figure the page
  // named the class without ever showing one.
  //
  // The graph pane is deliberately NOT here. The view's edges carry no
  // orientation -- its deletion detector takes any edge between two rank-0
  // segments with a coordinate gap, whatever the two orientations are -- so an
  // inversion's breakpoints draw as two dashed deletion arcs. Putting that under
  // a caption saying "inversion" would teach the drawing wrong. The bubble lane
  // is what states the flag, and the alignment is what shows the event.
  //
  // Same shape as hprc_cfhr_deletion: carrier above the reference, non-carrier
  // below, so both bands are against hg38. The highlight is the bubble's own
  // span from the links index rather than a measured one, and the carrier's
  // ribbon crosses inside it while its flanking ribbons run parallel, which is
  // the whole figure.
  //
  // `cigarMode: 'off'` because the one thing this figure means by a crossing is
  // an inversion. HPRC's PAF carries a CIGAR per record, and at 400 kb a record
  // the default 'full' mode paints each large indel in it as a wedge pinching to
  // a point -- several thin lines crossing each other, which read as exactly what
  // the caption says to look for. Blocks only, so a crossing is a reversed
  // record and nothing else.
  {
    mode: 'url',
    name: 'pangenome/hprc_inversion',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [[INV_CARRIER_TRACK], [INV_NONCARRIER_TRACK]],
          drawCurves: true,
          cigarMode: 'off',
          levelHeights: [150, 150],
          collapseEmptyRows: true,
          views: [
            { assembly: INV_CARRIER, loc: INV_CARRIER_WINDOW, tracks: [] },
            {
              assembly: 'hg38',
              loc: INV_WINDOW,
              highlight: [{ ...INV_BLOCK, color: 'rgba(60,65,72,0.10)' }],
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
                  // the lane the flag lives on, cut to the flagged bubbles so
                  // the one under the band is the subject rather than one row
                  // among the window's bubbles
                  jexlFiltersSetting: ['jexl:feature.inversion'],
                  height: 60,
                },
                hprcSegmentsLane(INV_REGION),
              ],
            },
            {
              assembly: INV_NONCARRIER,
              loc: INV_NONCARRIER_WINDOW,
              tracks: [],
            },
          ],
        },
      ],
    }),
    // the synteny canvas, not TOOLBAR_READY: this is the one HPRC figure with no
    // graph pane, so the plugin's toolbar never appears
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    viewportWidth: 1000,
    // the two ribbon bands, the three lanes between them and the bottom row's
    // ruler; 900 left 79 px of blank under it, per the run's own report
    viewportHeight: 820,
    hideTooltip: true,
    // Only the box. The haplotype rows carry no track of their own to anchor a
    // label to (the CFHR figure's labels hang off its per-haplotype gene lanes),
    // and the view chrome already names each row's assembly at its left edge, so
    // a callout would restate it.
    annotations: [
      {
        type: 'box',
        anchor: {
          view: [0, 1],
          track: 'hprc_minigraph_bubbles',
          locus: INV_BLOCK_LOCUS,
        },
      },
    ],
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
  // pairing: AMY1 copy number is what THESE TWO PROJECTIONS cannot state
  // (gfatools bubble and the rGFA tags record the distinct sequence a bubble can
  // hold, not how many times a haplotype repeats it), so what is worth drawing
  // here is the *shape* of the alternatives rather than an x axis. The bubbles
  // lane above carries the length range that stands in for copy number. The
  // release itself is not silent on it -- the .gbz carries a walk per haplotype,
  // which IS a copy count -- but that is a vg job, and the wave VCF is no
  // shortcut either since release 2 strips INFO/AT from it.
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
  // A donor node opened on the assembly that contributed it, which needs a
  // contributor the session can load: see CHM13_WINDOW for why CHM13 is the only
  // one in this graph, and for how the node was found.
  //
  // Three panes, and the middle one is the join. Top: the 30 kb GRCh38 window,
  // whose segments lane ends where the reference does. Middle: the graph cut from
  // that window, where the boxed node is 142 kb of CHM13 attached at a 75 bp
  // anchor -- an insertion the reference has no coordinates for, which is why the
  // top pane cannot show it. Bottom: that node on CHM13's own chr17, where it is
  // an ordinary interval with RefSeq genes over it and the same segments track
  // draws it as one feature.
  //
  // `resolveContributors` matches a node's PanSN sample against the session's
  // assembly *names*, so the assembly has to be named `CHM13` for the node menu to
  // offer it. `hs1` is an alias, not the name.
  //
  // The fixture's hs1 is a committed chrom.sizes, where the tutorial tells a
  // reader to load UCSC's `hs1.2bit`. Not a preference: hgdownload fetches fail
  // often enough from the capture box to have committed a broken figure twice (a
  // whole-file GET times out outright; the ranged 2bit read failed 2 of 6 times),
  // and this pane draws no sequence at 180 kb. Same shape as the four haplotype
  // assemblies beside it in that config. The genes are ours, not UCSC's,
  // `jbrowse.org/ucsc/hs1/hs1.gff.gz`, which is what the hg38 lane above reads
  // too.
  {
    mode: 'url',
    name: 'pangenome/hprc_chm13_allele',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: CHM13_WINDOW,
          highlight: [{ ...CHM13_BUBBLE, color: 'rgba(60,65,72,0.10)' }],
          tracks: [
            // no gene lane on this pane: 17q25.3 is subtelomeric and RefSeq has
            // one gene edge in the whole 30 kb, so the lane was blank. The bubble
            // is what this pane is for -- a 1,023 bp reference span whose longest
            // alternative is 146,023 bp, which is the number the graph below
            // draws.
            {
              trackId: 'hprc_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              // cut to the one bubble this figure is about. 29 bubbles land in
              // this 30 kb, each labelled over two lines, so the unfiltered lane
              // packs ten rows of small print and the reader has to find the
              // subject in it.
              jexlFiltersSetting: ['jexl:feature.longestAlleleLength>100000'],
              height: 60,
            },
            hprcSegmentsLane(CHM13_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: CHM13_REGION,
          layoutMode: 'force',
          colorScheme: 'reference-position',
        },
        {
          type: 'LinearGenomeView',
          assembly: 'hs1',
          loc: CHM13_ALLELE_WINDOW,
          // the node's own span, drawn by the app from its coordinates rather
          // than painted over the capture
          highlight: [{ ...CHM13_ALLELE, color: 'rgba(60,65,72,0.10)' }],
          tracks: [
            {
              trackId: 'hs1_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              displayMode: 'compact',
              height: 70,
            },
            // the same lane as the pane above, deliberately: a display's config
            // is per track, so a second color here would repaint the first pane
            // too. It needs no second color anyway -- the ramp's other branch
            // paints every rank>0 segment dark grey, which is what the graph
            // paints the boxed node, and every segment on this pane is rank 61.
            hprcSegmentsLane(CHM13_REGION),
          ],
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 180000,
    allowUnsettled: true,
    // the graph's own fetch is ~7 s here and the node box is anchored through the
    // view's nodePositions, so a shorter settle can capture before there are any
    settleMs: 14000,
    viewportWidth: 1000,
    viewportHeight: 1380,
    hideTooltip: true,
    annotations: [
      {
        type: 'box',
        anchor: { view: 1, graphNode: CHM13_NODE },
        strokeWidth: 3,
      },
    ],
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
  // `alleleLength(feature)>=50` takes the VCF to the same tier (a span filter
  // would keep deletions only, since an insertion consumes no reference). The
  // LV==0 half of SV_FILTER matters here too: vcfwave decomposed this file, so
  // an undecomposed bubble in the graph pane above can face several records
  // below, and the nested children would put one event in two columns.
  //
  // The marked deletion survives that filter (LV=0 on its own record) but is
  // MULTI-ALLELIC -- five deletion ALTs, four of 584 bp and one of 14,595 -- so
  // the colored block under the band is the site's carriers, not the 14,596 bp
  // allele's alone. The caption says "a deletion there" for that reason.
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
  // ALL 464 HAPLOTYPES, CLUSTERED (review: "it would be interesting to see to
  // increase the 'frission' of the figure. Please try it out ... and use
  // clustering on the track"). The previous pass declined this and the reason it
  // gave has since expired: `MHC_CALLSET_LAYOUT` cut the callset to the ten
  // donors so its row list would be the same length as the graph's sample rows,
  // and the graph in this figure is now the force drawing, which has no rows to
  // hold still against. With that gone there is nothing to pin, and the banded
  // deletion reads better across the cohort than across ten donors: clustering
  // gathers its carriers, so the band crosses a solid block of them instead of
  // nine scattered rows.
  //
  // 520px for the 464 rows, up from 260 for 20 — the aliasing the earlier note
  // was about is a row height under a pixel, and this is 1.1px per haplotype.
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
              height: 520,
              jexlFilters: SV_FILTER,
              runClustering: true,
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
    // three signals, ANDed: the graph drawn, the clustering RPC landed (its
    // dendrogram exists), and the callset's own fetch finished — not just first
    // paint, which an empty canvas flips on its own. A bare comma list would be
    // a CSS OR and fire on whichever landed first.
    readySelector:
      'body:has([data-testid="graph-perf-stats"]):has([data-testid="graph-layout-select"]):has([data-testid="tree_sidebar_dendrogram"]) [data-testid="variant-display-done"][data-display-phase="ready"]',
    readyTimeout: 360000,
    settleMs: 5000,
    viewportWidth: 1000,
    // the gene lane, the segments lane, the 464-row callset, and the graph pane
    // under them — the force drawing is about as tall as it is wide where the
    // row stack was flat
    viewportHeight: 1600,
    hideTooltip: true,
    // The event in the graph as well as in the tracks (review: "i see there is a
    // highlight on the lineargenomeview but no highlight in the graph itself").
    // The view's `highlight` is a band on a coordinate axis and the force
    // drawing has none, so the graph side is a ring on the node instead.
    //
    // s101145+ is the reference node the marked deletion removes most of:
    // 12,021 bp at GRCh38#0#chr6:32,517,416, ending at 32,529,437 against the
    // band's 32,529,438. Read out of `probe-graph-nodes.ts`, which also says the
    // band covers a run of eleven backbone nodes (s101135+ to s101145+) — this
    // is the one worth ringing, the other ten being a few hundred bp each.
    annotations: [
      {
        type: 'circle',
        anchor: { view: 1, graphNode: 's101145+' },
        radius: 26,
        strokeWidth: 3,
      },
      {
        type: 'text',
        // no length in the words: the 12.3 kb allele sits beside this node and
        // labels itself, so "12 kb" in a callout would read as that one
        text: 'The banded deletion, in the graph:\nthe ringed node is the reference it removes',
        anchor: { selector: '[data-testid="graph-genome-canvas"]' },
        dx: -470,
        dy: -270,
        maxWidth: 300,
        fontSize: 20,
      },
    ],
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
      // What the ring is around, which the frame did not say: the tooltip gives
      // the node's own length and CFT073 offset, and the band gives the K12
      // interval, but nothing put the two side by side, so review asked "is
      // this a 65kb 'non reference insertion'?". It is. Both numbers are the
      // graph's, not arithmetic on a picture: s2037 is 65,410 bp
      // (`ecoli_minigraph.segs.bed.gz`), and it attaches to s402 and s405,
      // which leaves K12 chr:1,095,502-1,097,564 between them — the same
      // 2,062 bp the hover band is drawing.
      {
        type: 'text',
        text: 'CFT073 insertion: 65.4 kb\nwhere K12 has 2.1 kb',
        anchor: { view: 1, graphNode: HOVERED_ALLELE },
        dx: -130,
        dy: 90,
        maxWidth: 210,
        fontSize: 16,
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
