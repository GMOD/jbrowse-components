// The HPRC release 2 human pangenome figures: the minigraph-cactus graph over
// GRCh38, for the pangenome_hprc tutorial.
//
// The E. coli half of what used to be one specs/graph.ts is
// specs/graph-ecoli.ts, and the two share only what specs/graph-fixtures.ts
// holds.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import {
  PORTAL_CONFIG,
  PORTAL_LOCI,
  portalGraphLaunch,
  portalLanesView,
} from './genomes_pangenome.ts'
import {
  GRAPH_DRAWN,
  cutNear,
  graphTrack,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'

import type {
  Annotation,
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

// The HPRC figures draw the graph as a track of the linear view: the segments
// track's LinearGraphDisplay, which cuts the view's window plus a window-width
// each side from the track's own tabix indexes.
const HPRC_CONFIG = local('test_data/graphgenomeview/hprc.json')
const SEGMENTS_TRACK = 'hprc_minigraph_segments'

// The off-reference allele pangenome/hprc_mhc_layout_force right-clicks, named rather than measured — see HOVERED_ALLELE. `node
// scripts/probe-graph-nodes.ts pangenome/hprc_mhc_layout_force` prints the
// cut's ids with their lengths and ranks.
//
// It is 1,780 bp of NA20809 hap 2 (`CM094351.1:32,495,296-32,497,076` in the
// links index, rank 10), and the two backbone segments it hangs off are
// s329874+, ending at chr6:32,517,416, and s329886+, starting at 32,529,437 —
// so the interval it attaches across is 12,021 bp of GRCh38, which release 2.1
// cuts into eleven segments (s329875 to s329885, the longest s329879 at 4,280
// bp) where 2.0 had the one 12 kb node s101145, and which is what
// **Highlight in hg38** writes into the linear view. That is also, near
// exactly, HLA-DRB5 (chr6:32,517,353-32,530,287), the gene present only on
// DR51 haplotypes. Release 2.0 credited the same allele to HG01433 hap 2
// (s318599); minigraph names an allele after the first assembly it saw it in,
// and 2.1's build order differs.
//
// Which is why the caption has to say it (review: "it looks like this is
// highlighting a 'black' node, instead of the green one, which is, afaict, the
// reference path"). Under the reference-position ramp black means "no reference
// position", i.e. this IS the allele the figure is about, and the green 12 kb
// node beside it is the reference segment the highlight lands on. Nothing in the
// frame joins the two, so a ring on a black node over a band 12 kb wide reads as
// the wrong node being ringed unless the words are there.
const HPRC_ALLELE = 's348700+'

// The inversion figure, at 1q21.1. `hprc-v2.1-mc-grch38.bubbles.bed.gz` flags
// this bubble as an inversion (245 of its 129,611 rows carry that column), and
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
// Each haplotype's own CAT annotation, which is what makes the non-carrier row
// worth its height (review: "the third sample ... looks like it matches the hg38
// reference so not interesting, can consider deleting third row"). With gene
// lanes on both, the crossing ribbon is no longer the only thing said twice: the
// named genes inside the block run PPIAL4F, RNVU1-28, RNVU1-2A, RNVU1-26,
// NBPF15, RNVU1-15, PPIAL4E down the carrier and PPIAL4E, RNVU1-15, NBPF15,
// RNVU1-26, RNVU1-2A, RNVU1-28, PPIAL4F down the non-carrier, i.e. reference
// order on one row and reversed on the other. That is the reading a crossing
// ribbon alone cannot separate from a contig deposited backwards.
const INV_CARRIER_GENES = 'hprc_inv_genes_HG01891_1'
const INV_NONCARRIER_GENES = 'hprc_inv_genes_HG02698_2'
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

// THE TWO GENES THAT SWAP, read out of the two CAT GFFs rather than off the
// picture (`zcat test_data/graphgenomeview/hprc_inv_<hap>.genes.gff3.gz`, gene
// records only). They are the outermost named pair inside the flagged bubble on
// both haplotypes, which is what makes them the pair to box:
//
//   HG01891.1 (carrier)     PPIAL4F 6,537,074  ...  PPIAL4E 6,757,129
//   HG02698.2 (non-carrier) PPIAL4E 4,064,546  ...  PPIAL4F 4,284,528
//
// Boxed on both rows because the claim was being ASSERTED (review: "the 'genes
// reversed in this block' is hard to see in this figure"). It was: the evidence
// was a run of eight ~9 px gene labels on one row against the same eight in the
// other order on a row 700 px below it, and the pill told the reader the answer
// rather than pointing at it. Two boxes per row is the same claim as a picture --
// the left box on the carrier and the right box on the non-carrier name the same
// gene.
const INV_CARRIER_PPIAL4F = 'JAGYVO020000062.1:6,537,074-6,537,833'
const INV_CARRIER_PPIAL4E = 'JAGYVO020000062.1:6,757,129-6,757,888'
const INV_NONCARRIER_PPIAL4E = 'JBHDTM010000033.1:4,064,546-4,065,305'
const INV_NONCARRIER_PPIAL4F = 'JBHDTM010000033.1:4,284,528-4,285,287'

// The left edge of a window, as a point locus: what a row label anchors to, so
// the callout sits at the start of the row it names instead of at a measured x.
const windowStart = (loc: string) => loc.split('-')[0]!

// C4, from the tutorial's own table of loci worth a look.
// `tabix hprc-v2.1-mc-grch38.links.bed.gz 'GRCh38#0#chr6:31980000-32050000'`
// gives 13 rank-0 backbone segments and 21 links out to non-reference segments
// with ranks up to 165, which is C4A/C4B copy number and the HERV insertion as
// the graph records them.
//
// 70 kb is a readability choice: the region cap is 5 Mb and the node budget
// 20,000. A graph track cuts a window-width either side of the view as well,
// so the force figures here pass `maxRegionBp` a little over their window,
// which narrows those margins away. A wider cut makes a force figure worse,
// measured rather than guessed — the plugin's Bandage WASM run offline over the
// real subgraphs (agent-docs/reference/PANGENOME_GRAPHS.md records them) gives,
// fitted to the pane:
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

// Wide enough to the left that LPA's own start (160,531,482) is in frame, so the
// gene track labels it: a window sitting entirely inside one gene draws that
// gene's label off the left edge, and the figure then names nothing.
const LPA_WINDOW = 'chr6:160,525,000-160,655,000'
// MHC class II, the densest window in the tutorial's locus table, and the one
// where the graph and the callset are worth putting in one frame.
const MHC_CLASSII_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 32510000,
  end: 32600000,
}

// The one event pangenome/hprc_graph_vs_callset marks in both products: the
// record at chr6:32,517,422 with a 12,014 bp REF, the largest in the window,
// whose four 1.8 kb alleles are a 10,246 bp deletion carried by 46 of 437
// haplotypes (AC 13, 1, 23 and 9; the other alleles are 11 and 6 bp shorter
// than REF). From the callset itself —
// `tabix hprc-v2.1-mc-grch38.wave.vcf.gz chr6:32510000-32600000`, longest REF
// among the records the SV filter keeps — and the same event HPRC_ALLELE is
// in the graph: 1.8 kb standing in for 12 kb of HLA-DRB5. Release 2.0's
// largest record here was a 14,596 bp deletion at 32,514,842.
const MHC_MARKED_DELETION = '6:32,517,422-32,529,435'

// SV_FILTER with that one record let through. vcfwave nests the DRB5 record
// under the class II snarl at LV=1 in release 2.1 (2.0 had it top-level), and
// the LV==0 half of the filter would leave the band over an empty column;
// admitting it by position keeps the rest of the matrix at the top level,
// which is what stops one event landing in two columns. `feature.start` is
// 0-based, the VCF POS less one.
const MHC_CALLSET_FILTER = [
  'jexl:(feature.INFO.LV[0]==0 || feature.start==32517421) && alleleLength(feature)>=50',
]

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
// Colored by the graph's own reference-position ramp over the window, the
// colors the graph track paints the same backbone in.
function hprcSegmentsLane(domain: { start: number; end: number }) {
  return {
    trackId: SEGMENTS_TRACK,
    type: 'LinearBasicDisplay',
    showLabels: 'none',
    heightMode: 'grow',
    color: referencePositionColor(domain),
  }
}

// The hg38 gene lane every figure on this page carries, collapsed to one
// longest coding transcript and compact. Seven copies of the same four keys,
// which is what a lane shared across a page should be — and the height is the
// only thing any of them varied.
function hg38GeneLane(height: number) {
  return {
    trackId: 'hg38_ncbiRefSeq_ucsc',
    type: 'LinearBasicDisplay',
    geneGlyphMode: 'longestCoding',
    displayMode: 'compact',
    height,
  }
}

// A haplotype row's own genes: HPRC's CAT annotation of that assembly, sliced to
// the window by scripts/build_hprc_inversion_synteny.sh. Same glyph settings as the hg38 lane
// between them, so the three rows are read the same way and the missing genes
// are missing rather than differently drawn.
function haplotypeGeneLane(trackId: string) {
  return {
    trackId,
    type: 'LinearBasicDisplay',
    geneGlyphMode: 'longestCoding',
    displayMode: 'compact',
    height: 70,
  }
}

// ClinVar and ClinGen were the first candidates and mark nothing here: ClinVar
// is ~300 SNVs across all of LPA. Swiss-Prot's domain annotation names each
// kringle, one per KIV-2 copy the reference carries.
//
// A cut of UCSC's unipDomain.bb, because hgdownload stalled past the app's 30 s
// limit during capture: its Swiss-Prot rows over LPA (column 17), BED12.
const HG38_UNIPROT_DOMAINS_TRACK = {
  trackId: 'hg38_uniprot_domains_lpa',
  name: 'UniProt domains (Swiss-Prot)',
  assemblyNames: ['hg38'],
  uri: 'https://jbrowse.org/demos/hprc/lpa_uniprot_domains.bed.gz',
}

// The structural tier of the wave VCF, which is what makes it comparable to the
// graph: minigraph collapses everything under ~50 bp, so an unfiltered callset
// is thousands of SNP columns the graph never had. `alleleLength` rather than
// end-start because an insertion consumes no reference and a span filter would
// keep only deletions. LV==0 drops the nested children vcfwave's decomposition
// writes beside their parents, which would otherwise put one event in two
// columns. Same filter the hprc2 matrix figures use.
const SV_FILTER = ['jexl:feature.INFO.LV[0]==0 && alleleLength(feature)>=50']

// The one node the MHC figures ring: the allele itself, black under the
// reference-position ramp because it has no reference position. Release 2.1
// cuts the 12 kb it attaches across into eleven segments, none a landmark.
const MHC_LANDMARK_NODES = [HPRC_ALLELE]

// The MHC class II cut, force-directed, with the right-click route to
// Highlight in hg38: the menu, the ring and the band the menu leaves behind.
const mhcLayoutForceSpec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/hprc_mhc_layout_force',
  // `Highlight in hg38` writes the node's reference interval into the linear
  // view's own highlight list, where it stays, so one frame carries both the
  // menu and its result: click the item, then right-click the same node again.
  actions: [
    // the auto-fit has to have finished before the anchor means anything
    { type: 'delay', ms: 2000 },
    { type: 'rightclick', anchor: { graphNode: HPRC_ALLELE } },
    { type: 'waitForText', text: 'Highlight in hg38' },
    { type: 'click', text: 'Highlight in hg38' },
    { type: 'delay', ms: 1500 },
    { type: 'rightclick', anchor: { graphNode: HPRC_ALLELE } },
    { type: 'waitForText', text: 'Node details' },
    { type: 'delay', ms: 500 },
  ],
  url: sessionSpec(HPRC_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: 'chr6:32,500,000-32,560,000',
        // No bubbles lane: at this window the class II bubble runs the whole
        // width and the five small ones pack against the right edge, where
        // their label lines are cut off.
        tracks: [
          hg38GeneLane(70),
          graphTrack(SEGMENTS_TRACK, {
            layoutMode: 'force',
            colorScheme: 'reference-position',
            showDeletionEdges: true,
            maxRegionBp: cutNear(60_000),
            // The force drawing here is a tall narrow chain ending in a 9.4 kb
            // loop, so it would take the whole 600 px ceiling; lower, it fits
            // smaller and the fixed-size node labels stay the size they were.
            paneHeight: 420,
          }),
        ],
      },
    ],
  }),
  readySelector: GRAPH_DRAWN,
  readyTimeout: 90000,
  viewportWidth: 820,
  viewportHeight: 750,
  hideTooltip: true,
  annotations: [
    ...MHC_LANDMARK_NODES.map((graphNode): Annotation => ({
      type: 'circle',
      anchor: { graphNode },
      radius: 24,
      strokeWidth: 3,
    })),
    // the item that produced the band
    { type: 'box', anchor: { text: 'Highlight in hg38' } },
  ],
}

// ---------------------------------------------------------------------------
// What website/scripts/video-specs.ts films on this dataset
// ---------------------------------------------------------------------------

// The callset lane the clustering tour drives, and the session it sits in.
//
// The SV filter is already applied, where the tour's own move is the clustering.
// Driving the filter too would mean driving the Edit filters dialog, and no spec
// here does that yet, so a tour that tried would be guessing at labels rather
// than repeating a route something already proves.
//
// `runClustering` is deliberately ABSENT: it is what the tour clicks, so a
// session that arrives already clustered has nothing left to film.
export const hprcClusterFixtures = {
  session: sessionSpec(HPRC_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: 'chr6:32,510,000-32,600,000',
        tracks: [
          hg38GeneLane(60),
          hprcSegmentsLane(MHC_CLASSII_REGION),
          {
            trackId: 'hprc2_wave_grch38',
            type: 'LinearMultiSampleVariantDisplay',
            height: 340,
            filter: SV_FILTER,
          },
        ],
      },
    ],
  }),
  trackId: 'hprc2_wave_grch38',
  // the callset's own fetch finished, rather than first paint, which an empty
  // canvas flips on its own
  ready: `${displayPainted('variant-display')}[data-display-phase="ready"]`,
  // the clustering RPC landed: its dendrogram exists beside the rows
  clustered: '[data-testid="tree_sidebar_dendrogram"]',
}

// The bubble tier and the curve it was built from, shared by the
// whole-chromosome figure and the chromosome tour.
//
// The tier is one node per BUBBLE (scripts/build_bubble_tier.sh over the
// `gfatools bubble` decomposition, hosted as hprc-v2.1-mc-grch38.tier10000.*),
// which is what makes a whole chromosome drawable at all: 474 nodes for chr1
// against ~751k segments in the graph.
const HPRC_TIER_SESSION_TRACK = {
  type: 'GraphTrack',
  trackId: 'hprc_tier',
  name: 'HPRC release 2 graph: bubble tier (one node per bubble)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'RgfaTabixAdapter',
    uri: 'https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.tier10000',
    assemblyNameToPanSN: { hg38: 'GRCh38' },
  },
}

// The same bubble file as a curve. No new data and no new code:
// MinigraphBubbleAdapter already sets `score` to the bubble's segment count and
// extends BaseFeatureDataAdapter, which supplies getRegionQuantitativeStats off
// `scoresToStats`, so only the track TYPE changes — a FeatureTrack offers no
// wiggle display to choose. 9,444 bubbles on chr1 with segment counts into the
// hundreds, so at 249 Mb each pixel aggregates a handful and the profile is
// real rather than sampled.
const HPRC_BUBBLE_SCORE_SESSION_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hprc_bubble_score',
  name: 'HPRC release 2 graph: variability (segments per bubble)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MinigraphBubbleAdapter',
    uri: 'https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38.bubbles.bed.gz',
    assemblyNameToPanSN: { hg38: 'GRCh38' },
  },
}

// The ideogram as a lane, on the same axis as the bubbles. The Giemsa stain is
// column 5 of UCSC's cytoBand BED and lands on `gieStain` positionally
// (`chr1 125100000 143200000 q12 gvar`); uncoloured the lane is one gold bar
// the length of the chromosome, and with the stain it is the ideogram, where
// acen (the centromere) and gvar (1q12) are the two bands that are not grey.
function cytobandLane() {
  return {
    trackId: 'hg38_cytobands_ucsc',
    type: 'LinearBasicDisplay',
    displayMode: 'collapsed',
    showLabels: 'none',
    color:
      "jexl:get(feature,'gieStain')=='acen' ? 'rgb(190,50,50)' : " +
      "get(feature,'gieStain')=='gvar' ? 'rgb(120,120,200)' : " +
      "get(feature,'gieStain')=='stalk' ? 'rgb(100,160,100)' : " +
      "get(feature,'gieStain')=='gneg' ? 'rgb(235,235,235)' : " +
      "get(feature,'gieStain')=='gpos25' ? 'rgb(190,190,190)' : " +
      "get(feature,'gieStain')=='gpos50' ? 'rgb(150,150,150)' : " +
      "get(feature,'gieStain')=='gpos75' ? 'rgb(110,110,110)' : 'rgb(70,70,70)'",
    height: 30,
  }
}

// ---------------------------------------------------------------------------
// A node opened on the haplotype that contributed it, on the config the HPRC
// page launches
// ---------------------------------------------------------------------------
//
// NA20809 haplotype 2 is the donor minigraph credits HPRC_ALLELE to. The
// portal config declares every release 2 haplotype as its chromosome lengths,
// aliased by its PanSN `sample#haplotype`, beside a BED of its CAT genes, so
// the node menu offers `Open in NA20809.2` with no map on the segments track.
const HAPLOTYPE = 'NA20809.2'
// HPRC_ALLELE's own span on the haplotype
const HAPLOTYPE_ALLELE_LOCUS = 'CM094351.1:32,495,297-32,497,076'
const HAPLOTYPE_GENES_TRACK = 'NA20809.2_cat_genes'
const HAPLOTYPE_GENES_DISPLAY = `${HAPLOTYPE_GENES_TRACK}-LinearBasicDisplay`
const HAPLOTYPE_GENES_READY = `[data-display-id="${HAPLOTYPE_GENES_DISPLAY}"][data-display-phase="ready"]`
// The launched view is the one holding the haplotype's genes.
const LAUNCHED_ZOOM_OUT = `[data-testid^="view-container-"]:has([data-display-id="${HAPLOTYPE_GENES_DISPLAY}"]) [data-testid="zoom_out"]`
const launchedZoomOut = (clicks: number): ScreenshotAction[] =>
  Array.from({ length: clicks }, () => [
    { type: 'click' as const, selector: LAUNCHED_ZOOM_OUT },
    { type: 'waitForAppSettled' as const, timeout: 120000 },
  ]).flat()
// The HLA / MHC launch as pangenome_hprc's reader has it by this step: at the
// class II window it types, in the force layout it switched to at C4.
const MHC_FORCE_LAUNCH = portalGraphLaunch({
  loc: 'chr6:32,500,000-32,560,000',
  layoutMode: 'force',
})

const HOSTED_HPRC_CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/hprc/config.json',
)
const ABCA7_REPEAT_KEY = 'chr19:1049406-1050096'
const ABCA7_SAMPLES = [
  'HG00099',
  'HG03688',
  'HG00741',
  'HG02647',
  'HG01943',
  'HG02559',
  'HG04199',
]

// The adotto catalogue's row for the VNTR (adotto_repeats.hg38.bed.gz,
// chr19:1049407-1050096), the record TRGT genotyped. A FromConfigAdapter is
// not among the adapters the walk rows read repeats from, so the rows still
// measure against the TRGT record alone.
const ABCA7_VNTR_TRACK = {
  type: 'FeatureTrack',
  trackId: 'abca7_vntr',
  name: 'Tandem repeat catalogue (adotto)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'FromConfigAdapter',
    features: [
      {
        uniqueId: 'abca7_vntr',
        refName: 'chr19',
        start: 1049407,
        end: 1050096,
        name: 'ABCA7 VNTR',
      },
    ],
  },
}

// The VNTR's lanes over the walk rows of the gbz-base graph, which measure
// each walk against the TRGT record and tile it by the motif.
function abca7View({
  genes = true,
  pane = {},
}: {
  genes?: boolean
  pane?: Record<string, unknown>
} = {}) {
  return {
    type: 'LinearGenomeView',
    assembly: 'hg38',
    loc: 'chr19:1,049,000-1,050,500',
    tracks: [
      ...(genes
        ? [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              showOnlyGenes: true,
              displayMode: 'compact',
              height: 40,
            },
          ]
        : []),
      {
        trackId: ABCA7_VNTR_TRACK.trackId,
        type: 'LinearBasicDisplay',
        height: 40,
      },
      {
        trackId: 'hprc_abca7_trgt',
        type: 'LinearVariantDisplay',
        height: 40,
      },
      graphTrack('hprc_v2_1_gbz_lanes', {
        layoutMode: 'walkrows',
        colorScheme: 'uniform',
        subgraphHaplotypes: [],
        repeatTrackId: 'hprc_abca7_trgt',
        repeatKey: ABCA7_REPEAT_KEY,
        paneHeight: 600,
        ...pane,
      }),
    ],
  }
}

const AMYLASE_LANES = portalLanesView(PORTAL_LOCI.amylase)

export const hprcGraphSpecs: ScreenshotSpec[] = [
  // All 249 Mb of GRCh38 chr1 off the hosted bubble tier
  // (hprc-v2.1-mc-grch38.tier10000.*, one node per bubble: 474 for chr1). At
  // this span the FINE segments track refuses with "Too many features" and the
  // tier lane draws.
  {
    mode: 'url',
    name: 'pangenome/hprc_whole_chromosome',
    url: sessionSpec(HPRC_CONFIG, {
      sessionTracks: [
        // THE THREE LOCI THIS PAGE ALREADY OPENED, ON THE SAME AXIS, which is
        // what turns the curve from a shape into an index (review: "this is a
        // somewhat interesting figure, but its also kind of a 'dead end'. like,
        // why does the user care?"). All three of the page's chr1 subjects are
        // here: the amylase bubble the force graph draws, the 1q21.1 inversion,
        // and the CFHR3/CFHR1 deletion. Their coordinates are the same
        // constants those figures use.
        //
        // WHAT THIS DOES NOT CLAIM, because it was checked and is false: that
        // they are the tallest peaks. Ranked over all 9,444 chr1 bubbles by
        // segment count -- `tabix …bubbles.bed.gz 'GRCh38#0#chr1' | sort -k4nr`
        // -- amylase is 50th, the inversion 77th and the deletion 155th, so
        // they are the top 2% and not the top 5. The chromosome's biggest
        // bubble by a factor of ten is at 2.65-2.78 Mb, and 1q21.1 carries
        // several more in 144-148 Mb than the one this page opens. So the lane
        // says WHERE they are and lets a reader see the curve is high at each;
        // the ranks are in the prose, where a number can be attributed.
        //
        // A FeatureTrack rather than a highlight: at 178 kb per css px the
        // widest of the three is 0.7 px, so a shaded band would be a hairline
        // with a label floating over the lanes below. A feature draws at a
        // minimum width and carries its own name, which is the whole ask.
        {
          type: 'FeatureTrack',
          trackId: 'hprc_chr1_loci',
          name: 'Loci this page opens on chr1',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'FromConfigAdapter',
            adapterId: 'hprc_chr1_loci',
            features: [
              {
                uniqueId: 'amylase',
                refName: 'chr1',
                start: 103_611_080,
                end: 103_732_636,
                name: 'amylase',
                type: 'region',
              },
              {
                uniqueId: 'inv_1q21',
                refName: 'chr1',
                start: 144_419_292,
                end: 144_572_458,
                name: '1q21.1 inversion',
                type: 'region',
              },
              {
                uniqueId: 'cfhr',
                refName: 'chr1',
                start: 196_753_088,
                end: 196_837_771,
                name: 'CFHR3/CFHR1 deletion',
                type: 'region',
              },
            ],
          },
        },
        HPRC_TIER_SESSION_TRACK,
        HPRC_BUBBLE_SCORE_SESSION_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1',
          tracks: [
            // CYTOBANDS, AS A LANE AS WELL AS ON THE HEADER (review: "need to
            // see the cytobands on assembly config, and ideally, a bed track
            // showing this"). The fixture's hg38 now carries `cytobands`, so
            // the view's own overview band is banded rather than blank; the
            // BED lane under it is what puts 1q12 on the SAME axis as the
            // bubbles, which is the comparison the two callouts were making in
            // words. `showLabels: 'none'` -- 63 band names over 249 Mb is a
            // mat, and the two the figure names are named by the callouts.
            cytobandLane(),
            // Between the bands and the curve, so the reading order down the
            // frame is landmark, name, how much the graph varies there.
            {
              trackId: 'hprc_chr1_loci',
              type: 'LinearBasicDisplay',
              // NOT collapsed. Collapsed drops labels, and at 178 kb per css px
              // each of these features is a sub-pixel tick -- so collapsed the
              // lane was three orange specks and the names, which are the whole
              // content, were gone.
              height: 50,
            },
            {
              trackId: 'hprc_bubble_score',
              type: 'LinearWiggleDisplay',
              height: 110,
            },
            {
              trackId: 'hprc_tier',
              type: 'LinearBasicDisplay',
              showLabels: 'none',
              // PACKED, and collapsed was tried and reverted. Three rows of
              // yellow boxes at 178 kb per pixel is close to a mat, so
              // collapsing to one row looked like the same cleanup the qc
              // callset lanes got — but it made the lane a solid bar edge to
              // edge, including across the 1q gap the other two lanes go blank
              // over. One row means one long bubble spanning the gap fills it,
              // and the gap is the thing worth seeing. Packed keeps it.
              height: 60,
            },
          ],
        },
      ],
    }),
    readyTimeout: 300000,
    viewportWidth: 1400,
    // No graph pane (review: "the whole chromosome is too busy frankly and
    // linearized view is sortofpointless, we have thelinaergenomeview"). The
    // tier is a path, one node per bubble with an edge to the next, so its
    // anchored drawing restated the lanes above and a force drawing of it is
    // one arc; the tier lane carries the same nodes on the axis.
    viewportHeight: 580,
    hideTooltip: true,
    // The blank is the loudest thing in the picture and nothing on the image
    // said what it was. The caption used to call it the centromere and 1q12,
    // which is both something a reader has to already know and not what the
    // files say: bubbles ARE called across the centromere (21 in the 124th Mb,
    // 40 in the 125th). The continuous blank runs 125,183,471 to 143,314,415 in
    // the bubbles BED, and the tier BED carries exactly one node over it —
    // `bb_GRCh38#0#chr1_125178636`, 125,178,636-143,831,879, which is the
    // 18.7 Mb the graph labels. That is GRCh38's own heterochromatin gap
    // on 1q: a run of N, so nothing aligns and no bubble is called, and the
    // graph spends one backbone node crossing it.
    //
    // Naming the node is what makes the three lanes one picture rather than
    // three, so the label says it and the caption says it.
    //
    // The pill sits IN the gap rather than above the lane: at this height a
    // callout lifted clear of the curve lands on the view's own header, and the
    // blank column is both where it belongs and the only place on the lane
    // where it covers no data.
    // WORDING: the label says what a reader is looking at, in words that need
    // nothing else on the page. "GRCh38's own gap on 1q: no bubbles, one
    // 18.7 Mb backbone node instead" packed three pieces of vocabulary (gap,
    // bubble, backbone node) into a contrast, and the reviewer could not tell
    // what it was claiming. What makes the column blank is that there is no
    // sequence there to align to, so that is the sentence.
    //
    // IT NAMES THE BAND NOW (review: "is that the centromere? just say so").
    // The honest answer is no, and next to it — which is why a label that only
    // described the blank kept inviting the question. The blank is 1q12, the
    // heterochromatic band immediately distal to the centromere
    // (125,100,000-143,200,000 in GRCh38's cytoband file, against a modeled
    // centromere ending at 125,100,000), and the bubbles BED's continuous blank
    // runs 125,183,471-143,314,415 inside it. The centromere itself is NOT
    // blank here: 21 bubbles are called in the 124th Mb and 40 in the 125th. So
    // pointing at this column and saying "centromere" would be wrong in a way
    // the same figure disproves two centimetres to the left.
    //
    // TWO WORDS, WHICH IS THE WHOLE LABEL (review: "too much text, reduce to
    // bare minimum e.g. just put arrow pointing at 'pericentromere' and
    // 'centromere' itself"). The paragraph that used to say why the column is
    // blank was 22 words on a 250px pill covering a fifth of the lane; it is
    // two landmarks named where they are, and the reason lives in the caption,
    // which is where a paragraph belongs.
    //
    // A BOX FOR THE CENTROMERE, NOT AN ARROW, and the arrow was rendered first.
    // The two landmarks are adjacent -- the centromere ends at 125.1 Mb and the
    // blank starts at 125.18 Mb -- and at 178 kb per css px the whole centromere
    // is an 18 px sliver 20 px from the pill naming it. An arrow that short
    // draws as a red smudge with no direction in it. The box states the band's
    // extent instead, and the pill beside it needs no arrow at all.
    //
    // The box goes on the TIER lane rather than the curve because that is where
    // the claim is: bubbles are called right across the centromere (21 in the
    // 124th Mb, 40 in the 125th), so a box there is full of blocks and the
    // column immediately right of it is empty.
    annotations: [
      // the blank column, labelled in the blank column. fontSize 14 and a
      // maxWidth that forces the second word onto its own line is what keeps
      // the pill inside the ~97 px the blank is wide; at 17 it ran 50 px out
      // over the curve.
      {
        type: 'text',
        text: 'pericentromere (1q12)',
        fontSize: 14,
        maxWidth: 100,
        anchor: {
          track: 'hprc_bubble_score',
          locus: 'chr1:126,000,000',
          fracY: 0.08,
        },
      },
      {
        type: 'box',
        strokeWidth: 3,
        anchor: {
          track: 'hprc_tier',
          locus: 'chr1:121,700,000-125,100,000',
        },
      },
      {
        type: 'text',
        text: 'centromere',
        fontSize: 14,
        maxWidth: 100,
        anchor: {
          track: 'hprc_tier',
          locus: 'chr1:126,000,000',
          fracY: 0.06,
        },
      },
    ],
  },
  mhcLayoutForceSpec,
  // The C4 cut with its parts named, above the page's end-to-end clip. Both
  // anchors come from `node scripts/probe-graph-nodes.ts
  // pangenome/hprc_graph_anatomy`: s352179+ is NA18948's 21 kb allele, the
  // largest off-reference node in the window.
  {
    mode: 'url',
    name: 'pangenome/hprc_graph_anatomy',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: C4_WINDOW,
          tracks: [
            hg38GeneLane(70),
            graphTrack(SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              colorScheme: 'reference-position',
              showDeletionEdges: true,
              maxRegionBp: cutNear(70_000),
              // Halos and route chips are introduced on the KIV-2 figure
              // further down; here they arrived unexplained, and one chip sat
              // over the C4A junction the backbone label points past.
              showBubbles: false,
            }),
          ],
        },
      ],
    }),
    // Bare names, not glosses: the prose above the figure carries what each one
    // means, and a gloss ran the pill off the pane. Neither deletion gets a
    // callout: the renderer writes "32.7 kb del" across the arc itself.
    // Each pill sits toward the pane's edge, and each leader arrives at its node
    // near a right angle, so no leader reads as a piece of the graph and no
    // arrow ends at another label. Positions come from `node
    // scripts/probe-graph-nodes.ts pangenome/hprc_graph_anatomy`.
    annotations: [
      // s329770+ is the 14.3 kb CYP21A2 backbone node on the blue end of the
      // ramp, with open pane to its right. The 52 kb node is painted red by the
      // ramp and a red leader into it read as one arrow.
      {
        type: 'text',
        text: 'backbone',
        leader: true,
        fontSize: 20,
        anchor: { graphNode: 's329770+' },
        dx: 110,
        dy: 50,
      },
      // s352179+ is NA18948's 21 kb allele, the largest off-reference node in
      // the window. It runs to the lower left, so the pill hangs off it to the
      // left and the leader comes in across the node.
      {
        type: 'text',
        text: 'allele',
        leader: true,
        fontSize: 20,
        anchor: { graphNode: 's352179+' },
        dx: -120,
        dy: -40,
      },
      // s329764+ is one wall of the clearest lens in the cut: the reference
      // path, and the dashed 32.7 kb deletion arc bypassing it between the same
      // two nodes. An anchor names a node and a bubble is a pair of routes, so
      // the caption says what the two routes are. Below-left is the one side
      // where the leader crosses nothing; the offset keeps the pill clear of the
      // allele arrowhead above it.
      {
        type: 'text',
        text: 'bubble',
        leader: true,
        fontSize: 20,
        anchor: { graphNode: 's329764+' },
        dx: -130,
        dy: 145,
      },
    ],
    readySelector: GRAPH_DRAWN,
    readyTimeout: 120000,
    allowUnsettled: true,
    viewportWidth: 1000,
    viewportHeight: 940,
    hideTooltip: true,
  },
  // The inversion figure. Insertions are nodes and deletions are edges, and the
  // tutorial drew both; an inversion is neither, and until this figure the page
  // named the class without ever showing one.
  //
  // The graph track is deliberately NOT here. The view's edges carry no
  // orientation -- its deletion detector takes any edge between two rank-0
  // segments with a coordinate gap, whatever the two orientations are -- so an
  // inversion's breakpoints draw as two dashed deletion arcs. Putting that under
  // a caption saying "inversion" would teach the drawing wrong. The bubble lane
  // is what states the flag, and the alignment is what shows the event.
  //
  // Carrier above the reference, non-carrier below, so both bands are against hg38. The highlight is the bubble's own
  // span from the links index rather than a measured one, and the carrier's
  // ribbon crosses inside it while its flanking ribbons run parallel, which is
  // the whole figure.
  //
  // BOTH HAPLOTYPE ROWS CARRY THEIR OWN CAT GENES, and that is what keeps the
  // non-carrier row (review: "this looks like it matches the hg38 reference so
  // not interesting, can consider deleting third row"). It does match, and that
  // is its job: a lone crossing ribbon is equally what an assembly whose contig
  // was deposited in the opposite orientation draws, which is why the build
  // script tests the flanks rather than the block. The gene lanes put that test
  // in the frame — inside the boxed bubble the carrier's named genes run
  // PPIAL4F, RNVU1-28, RNVU1-2A, RNVU1-26, NBPF15, RNVU1-15, PPIAL4E and the
  // non-carrier's run the reference's order, PPIAL4E through PPIAL4F. Delete the
  // third row and the figure has a crossing with nothing to compare it against.
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
          // The crossing band keeps its height; the non-carrier's does not need
          // it. A band's job here is to be followed across, and the lower one is
          // a single parallel ribbon — 150 px of it was the "third row is
          // boring" half of the review, and the answer is to spend that height
          // on the gene lane under it instead of on the ribbon.
          levelHeights: [150, 90],
          collapseEmptyRows: true,
          views: [
            {
              assembly: INV_CARRIER,
              loc: INV_CARRIER_WINDOW,
              tracks: [haplotypeGeneLane(INV_CARRIER_GENES)],
            },
            {
              assembly: 'hg38',
              loc: INV_WINDOW,
              highlight: [{ ...INV_BLOCK, color: 'rgba(60,65,72,0.10)' }],
              tracks: [
                hg38GeneLane(70),
                {
                  trackId: 'hprc_minigraph_bubbles',
                  type: 'LinearBasicDisplay',
                  // the lane the flag lives on, cut to the flagged bubbles so
                  // the one under the band is the subject rather than one row
                  // among the window's bubbles
                  filterSetting: ['jexl:feature.inversion'],
                  height: 60,
                },
                // Bounded where the other pages let it grow: this is the one
                // figure whose lane shares a fixed budget with two more rows
                // below it, and a grown lane is 595 px here (ADR-037 reserves
                // the min-width clamp, so sub-pixel segments stack as deep as
                // their deepest pile), which puts the non-carrier row's genes
                // 460 px past the bottom of the capture. `fit` squeezes the
                // same segments into the height instead of cutting them off.
                {
                  ...hprcSegmentsLane(INV_REGION),
                  heightMode: 'fit',
                  height: 45,
                },
              ],
            },
            {
              assembly: INV_NONCARRIER,
              loc: INV_NONCARRIER_WINDOW,
              tracks: [haplotypeGeneLane(INV_NONCARRIER_GENES)],
            },
          ],
        },
      ],
    }),
    // the synteny canvas: this is the one HPRC figure that draws no graph
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    allowUnsettled: true,
    viewportWidth: 1000,
    // the two ribbon bands, the three lanes between them and the bottom row's
    // ruler, plus a gene lane on each haplotype row and 60 px off the lower band
    viewportHeight: 965,
    hideTooltip: true,
    // The flagged bubble, and what each haplotype's own genes do inside it. The
    // row labels hang off the gene lanes the rows now carry, the same way the
    // CFHR figure's do, and they say the thing the ribbons cannot: a crossing
    // ribbon on its own is also what a contig deposited backwards draws, and it
    // is gene order agreeing with the reference on one row and running backwards
    // on the other that separates the two.
    annotations: [
      {
        type: 'box',
        anchor: {
          view: [0, 1],
          track: 'hprc_minigraph_bubbles',
          locus: INV_BLOCK_LOCUS,
        },
      },
      // the same two genes on each haplotype row, so the swap is a thing to
      // look at rather than a sentence to believe
      ...(
        [
          [0, INV_CARRIER_GENES, INV_CARRIER_PPIAL4F],
          [0, INV_CARRIER_GENES, INV_CARRIER_PPIAL4E],
          [2, INV_NONCARRIER_GENES, INV_NONCARRIER_PPIAL4E],
          [2, INV_NONCARRIER_GENES, INV_NONCARRIER_PPIAL4F],
        ] as const
      ).map(([level, track, locus]): Annotation => ({
        type: 'box',
        strokeWidth: 3,
        anchor: { view: [0, level], track, locus },
      })),
      // The order, spelled left to right so it matches what the boxes do. Short
      // enough to clear the leftmost box on its own row (the carrier's is 23%
      // across its window, the non-carrier's 38%), which is why the haplotype
      // names came off: each row's track header already reads "HG01891.1
      // genes (HPRC release 2 CAT annotation)".
      {
        type: 'text',
        fontSize: 17,
        maxWidth: 260,
        anchor: {
          view: [0, 0],
          track: INV_CARRIER_GENES,
          locus: windowStart(INV_CARRIER_WINDOW),
          fracY: 1,
          dx: 14,
          dy: -24,
        },
        text: 'PPIAL4F → PPIAL4E',
      },
      {
        type: 'text',
        fontSize: 17,
        maxWidth: 260,
        anchor: {
          view: [0, 2],
          track: INV_NONCARRIER_GENES,
          locus: windowStart(INV_NONCARRIER_WINDOW),
          fracY: 1,
          dx: 14,
          dy: -24,
        },
        text: 'PPIAL4E → PPIAL4F, as in hg38',
      },
    ],
  },
  // pangenome/hprc_repeat_classes was here and is DELETED (review: "i dont think
  // i really understand this figure. consider deleting. just not actually
  // valuable information?"). It drew each assembly's own last 650 kb of chr17 in
  // two panes, which is the only framing that keeps them the same width in bp,
  // and the cost of that framing is that the two panes are not the same
  // sequence: nothing in the picture says why two windows at different
  // coordinates may be read against each other, and the LINE/SINE swap it exists
  // for is a per-bin difference of a few percent.
  //
  // The measurement itself is sound and stays in the tutorial as text, where it
  // can be attributed. Over the two windows scripts/build_repeat_density.sh
  // reports LINE 13.71% -> 16.51%, SINE 13.58% -> 9.00%, LTR 6.10% -> 5.83%,
  // DNA 2.29% -> 3.01% and total repeat 37.22% -> 36.48%, so what moved is the
  // composition and not the quantity.
  //
  // DO NOT rebuild this as the insertion allele on its own, which is the obvious
  // next idea: the allele runs LINE 23.70% against 14.18% and 14.47% either
  // side, and 1.7x as a mean is not a shape a reader can see per bin.
  // pangenome/hprc_chm13_allele drew that sequence per element, the resolution
  // at which the L1 tiling is visible at all, and retired with part 3's CHM13
  // section.
  //
  // A SYNTENY VIEW WAS ALSO TRIED HERE AND IS WRONG FOR THIS COMPARISON
  // (rendered twice before concluding). A band needs the two panes to be
  // counterparts and these deliberately were not. Hung the UCSC hg38-to-hs1
  // liftOver chain between them as a session track and it paints a single flat
  // block across the whole band, because a liftOver chain is one
  // chromosome-scale feature whose base ribbon is one trapezoid: the band ends
  // up asserting the two windows correspond end to end. minAlignmentLength 20000
  // does not change it, and a synteny view's sub-panels carry no displayName, so
  // it also costs the two titles that said the panes were different intervals.

  // The KIV-2 repeat in LPA, picked out of the bubble index rather than off a
  // locus list. Every record in hprc-v2.1-mc-grch38.bubbles.bed.gz, ranked for a
  // bubble that is deeply traversed and still few enough segments to follow:
  // GRCh38 chr6:160,616,002-160,646,753 is 29 segments and 129 recorded paths
  // in release 2.1 (2.0: 33 segments, 584 paths, 160,606,991-160,639,012),
  // and its alleles reach 174,966 bp against the 31 kb of reference they replace.
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
      sessionTracks: [HG38_UNIPROT_DOMAINS_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: LPA_WINDOW,
          tracks: [
            hg38GeneLane(70),
            {
              trackId: HG38_UNIPROT_DOMAINS_TRACK.trackId,
              type: 'LinearBasicDisplay',
              height: 75,
            },
            {
              trackId: 'hprc_minigraph_bubbles',
              type: 'LinearBasicDisplay',
              // pinned, not grown: a bubble's label is two lines and the lane
              // packs few enough rows to fit them, so growing it only adds
              // whitespace under the last one
              height: 80,
            },
            graphTrack(SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              colorScheme: 'reference-position',
              showBubbles: true,
              maxRegionBp: cutNear(130_000),
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 180000,
    viewportWidth: 1000,
    viewportHeight: 1170,
    hideTooltip: true,
    annotations: [
      // s343607+ is HG02391#2's 68 kb segment inside the array bubble, the
      // longest node in the cut and the widest loop in the drawing
      {
        type: 'text',
        text: 'kringle copies one haplotype carries and GRCh38 does not',
        fontSize: 20,
        maxWidth: 260,
        leader: true,
        anchor: { graphNode: 's343607+' },
        textAlign: 'end',
        dx: -60,
        dy: 20,
      },
      // WHERE it is: the widest bar in the bubbles lane, whose record is
      // `chr6:160,616,002-160,646,753` in release 2.1. The UniProt lane above
      // confirms it independently, tiling that span with kringle domains.
      {
        type: 'box',
        anchor: {
          track: 'hprc_minigraph_bubbles',
          locus: 'chr6:160,616,002-160,646,753',
        },
        pad: 3,
      },
      {
        // KIV-2 is kringle IV type 2, and "kringle repeat" is what the array is
        // called outside the Lp(a) literature -- the label carries both so a
        // reader who knows one name recognises the other
        type: 'text',
        text: 'the KIV-2 array, aka the kringle repeat',
        fontSize: 18,
        // right-aligned so the offset places the pill's own right edge against
        // the box's left one; its width is only known once the text is measured
        textAlign: 'end',
        anchor: {
          track: 'hprc_minigraph_bubbles',
          locus: 'chr6:160,616,002-160,646,753',
          alignX: 'left',
          fracY: 0,
          dx: -16,
          dy: 12,
        },
      },
    ],
  },
  // The two products at one locus, which is the argument the HPRC tutorial
  // closes on ("the matrix for base-level variation across haplotypes, the
  // graph for how the sequence rearranges") and had no picture of. The graph
  // cannot say who carries an allele — it collapses identical sequence, so an
  // allele records one donor however many samples walk it — and that gap is the
  // point the tutorial makes.
  //
  // The callset is filtered to the structural tier so the two hold the same
  // class of event: minigraph collapses everything under ~50 bp, and
  // `alleleLength(feature)>=50` takes the VCF to the same tier (a span filter
  // would keep deletions only, since an insertion consumes no reference). The
  // LV==0 half of SV_FILTER matters here too: vcfwave decomposed this file, so
  // an undecomposed bubble in the graph can face several records, and the
  // nested children would put one event in two columns.
  //
  // The marked deletion survives that filter but is MULTI-ALLELIC -- nine
  // deletion ALTs, four of them the 1.8 kb allele (10,246 bp gone) and five
  // within 11 bp of REF -- so the colored block under the band is the site's
  // carriers, not the 10.2 kb allele's alone. The caption says "a deletion
  // there" for that reason.
  //
  // THE CORRESPONDENCE IS AN EVENT, NOT A ROW. rGFA's SN names the assembly
  // that FIRST CONTRIBUTED a segment, while a genotype names every haplotype
  // that CARRIES it. Checked at the marked deletion — the graph attributes
  // HG04157's only contribution here to HG04157.2, and the callset has HG04157
  // carrying that deletion on its FIRST haplotype; HG01993 goes the other way.
  // So graph rows and callset rows cannot be lined up, and relabelling the
  // callset into PanSN would assert a mapping that is not true.
  //
  // So the figure marks one EVENT instead: `highlight` puts a band on the
  // 12,014 bp record at chr6:32,517,422 across the gene lane and the genotype
  // matrix — 46 of 437 haplotypes carry its 10.2 kb deletion. The graph under
  // them is the force drawing (review: "consider using force directed bandage
  // graph"), where the same event is a bubble rather than a row. What the pair
  // says: the callset names who carries it, the graph names what the
  // alternative sequence is.
  //
  // ALL 464 HAPLOTYPES, CLUSTERED: clustering gathers the deletion's carriers,
  // so the band crosses a solid block of them instead of scattered rows.
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
            hg38GeneLane(60),
            {
              trackId: 'hprc2_wave_grch38',
              type: 'LinearMultiSampleVariantDisplay',
              // 464 haplotype rows fit in no height a figure can afford, so
              // the lane is a texture either way, and the graph under it is
              // the half this figure is about
              height: 340,
              filter: MHC_CALLSET_FILTER,
              runClustering: true,
            },
            graphTrack(SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              colorScheme: 'reference-position',
              maxRegionBp: cutNear(90_000),
            }),
          ],
        },
      ],
    }),
    // three signals, ANDed: the graph drawn, the clustering RPC landed (its
    // dendrogram exists), and the callset's own fetch finished — not just first
    // paint, which an empty canvas flips on its own. A bare comma list would be
    // a CSS OR and fire on whichever landed first.
    readySelector: `body:has(${GRAPH_DRAWN}):has([data-testid="tree_sidebar_dendrogram"]) ${displayPainted('variant-display')}[data-display-phase="ready"]`,
    readyTimeout: 360000,
    viewportWidth: 1000,
    viewportHeight: 1340,
    hideTooltip: true,
    // The event in the graph as well as in the tracks (review: "i see there is a
    // highlight on the lineargenomeview but no highlight in the graph itself").
    // The force drawing has no coordinate axis, so the graph side is a ring on
    // the node instead.
    //
    // The ring is on HPRC_ALLELE, the 1.8 kb node that IS the deletion in the
    // graph: the walk that takes it skips the 12 kb of backbone under the band
    // (s329875+ to s329885+ in release 2.1, eleven segments from 32,517,416 to
    // 32,529,437 against the band's 32,529,438).
    //
    // The band and the ring are joined by an ARROW rather than by a sentence
    // (review: "just draw arrow from highlight to circle, no text annotation or
    // more minimal text annotation on RIGHT side of screen"). Its tail is the
    // bottom of the highlighted span in the callset, so it leaves the band at
    // the band's own x, and its head stops short of the ring by the ring's own
    // radius — an anchored head resolves to the node's CENTRE, which would put
    // the triangle inside the circle.
    annotations: [
      {
        type: 'circle',
        anchor: { graphNode: HPRC_ALLELE },
        radius: 26,
        strokeWidth: 3,
      },
      {
        type: 'arrow',
        fromAnchor: {
          view: 0,
          track: 'hprc2_wave_grch38',
          locus: MHC_MARKED_DELETION,
          fracY: 1,
          dy: -8,
        },
        anchor: { graphNode: HPRC_ALLELE, dx: -30, dy: -30 },
        strokeWidth: 3,
      },
      {
        type: 'text',
        // no length in the words: the graph labels its longer nodes itself,
        // so a length in a callout would read as one of those
        text: 'the same deletion, in the graph',
        anchor: {
          selector: '[data-testid="graph-genome-canvas"]',
          alignX: 'right',
          alignY: 'top',
        },
        dx: -20,
        dy: 40,
        textAlign: 'end',
        maxWidth: 340,
        fontSize: 20,
      },
    ],
  },
  // The node menu's Open in NA20809.2 taken on the HPRC page's graph launch,
  // in two frames: the menu, then the view it opens.
  {
    mode: 'url',
    name: 'pangenome/hprc_haplotype_launch',
    url: MHC_FORCE_LAUNCH,
    readySelector: GRAPH_DRAWN,
    readyTimeout: 180000,
    viewportWidth: 1100,
    viewportHeight: 1232,
    hideTooltip: true,
    stages: [
      {
        viewportHeight: 1060,
        actions: [
          { type: 'delay', ms: 2000 },
          { type: 'rightclick', anchor: { graphNode: HPRC_ALLELE } },
          { type: 'waitForText', text: `Open in ${HAPLOTYPE}` },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { graphNode: HPRC_ALLELE },
            radius: 20,
            strokeWidth: 3,
          },
          { type: 'box', anchor: { text: `Open in ${HAPLOTYPE}` } },
        ],
      },
      {
        url: MHC_FORCE_LAUNCH,
        viewportHeight: 1330,
        actions: [
          { type: 'delay', ms: 2000 },
          { type: 'rightclick', anchor: { graphNode: HPRC_ALLELE } },
          { type: 'waitForText', text: `Open in ${HAPLOTYPE}` },
          { type: 'click', text: `Open in ${HAPLOTYPE}` },
          {
            type: 'waitForSelector',
            selector: HAPLOTYPE_GENES_READY,
            timeout: 180000,
          },
          ...launchedZoomOut(6),
          { type: 'delay', ms: 3000 },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { graphNode: HPRC_ALLELE },
            radius: 20,
            strokeWidth: 3,
          },
          {
            type: 'box',
            anchor: {
              view: 1,
              track: HAPLOTYPE_GENES_TRACK,
              locus: HAPLOTYPE_ALLELE_LOCUS,
            },
            pad: 4,
          },
          {
            type: 'arrow',
            fromAnchor: { graphNode: HPRC_ALLELE, dy: 22 },
            anchor: {
              view: 1,
              track: HAPLOTYPE_GENES_TRACK,
              locus: HAPLOTYPE_ALLELE_LOCUS,
              fracY: 0,
              dy: -6,
            },
            strokeWidth: 3,
          },
        ],
      },
    ],
  },
  // The KIV-2 record's copies by unit, opened the way a reader opens it: the
  // record's right-click item, which the TandemRepeat plugin the hosted config
  // loads adds to a variant track.
  {
    mode: 'url',
    name: 'pangenome/hprc_kiv2_copies_by_unit',
    url: sessionSpec(HOSTED_HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:160,596,000-160,666,000',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              showOnlyGenes: true,
              displayMode: 'compact',
              height: 40,
            },
            {
              trackId: 'hprc_kiv2_copies',
              type: 'LinearVariantDisplay',
              height: 40,
            },
          ],
        },
      ],
    }),
    viewportWidth: 1400,
    viewportHeight: 640,
    hideTooltip: true,
    actions: [
      { type: 'waitForAppSettled', timeout: 120000 },
      {
        type: 'rightclick',
        anchor: {
          locus: 'chr6:160,631,000',
          track: 'hprc_kiv2_copies',
          fracY: 0.2,
        },
      },
      { type: 'waitForText', text: 'Show repeat copies' },
      { type: 'click', text: 'Show repeat copies' },
      {
        type: 'waitForSelector',
        selector: '[data-testid="tandem-repeat-view"]',
      },
      { type: 'delay', ms: 500 },
    ],
  },
  // TRGT's ABCA7 alleles rewritten as <CNV:TR> records by the TandemRepeat
  // plugin's trgt-to-cnv-tr.mjs, opened by clicking the record
  {
    mode: 'url',
    name: 'pangenome/hprc_abca7_tandem_repeat_alleles',
    url: sessionSpec(HOSTED_HPRC_CONFIG, {
      sessionTracks: [
        {
          type: 'VariantTrack',
          trackId: 'hprc_abca7_cnvtr',
          name: 'TRGT alleles at ABCA7 as repeat records, 94 HPRC samples',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'VcfTabixAdapter',
            uri: 'https://jbrowse.org/demos/hprc/hprc_abca7_cnvtr.vcf.gz',
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr19:1,049,000-1,050,500',
          tracks: [
            {
              trackId: 'hprc_abca7_cnvtr',
              type: 'LinearVariantDisplay',
              height: 40,
            },
          ],
        },
      ],
    }),
    viewportWidth: 1400,
    viewportHeight: 760,
    hideTooltip: true,
    actions: [
      { type: 'waitForAppSettled', timeout: 120000 },
      {
        type: 'click',
        anchor: {
          locus: 'chr19:1,049,750',
          track: 'hprc_abca7_cnvtr',
          fracY: 0.2,
        },
      },
      {
        type: 'waitForSelector',
        selector: '[data-testid="tandem-repeat-view"]',
      },
      { type: 'delay', ms: 500 },
    ],
  },
  {
    mode: 'url',
    name: 'pangenome/hprc_abca7_repeat_units',
    url: sessionSpec(HOSTED_HPRC_CONFIG, {
      sessionTracks: [ABCA7_VNTR_TRACK],
      views: [abca7View()],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 240000,
    viewportWidth: 1400,
    viewportHeight: 1065,
    hideTooltip: true,
    actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
  },
  {
    mode: 'url',
    name: 'pangenome/hprc_abca7_disagreements',
    url: sessionSpec(HOSTED_HPRC_CONFIG, {
      sessionTracks: [ABCA7_VNTR_TRACK],
      views: [
        abca7View({
          genes: false,
          pane: {
            // three samples whose calls land on both walks, two where reads
            // and assemblies part, and two carrying a walk the view leaves
            // unscored: HG02559's second allele has no spanning read,
            // HG04199's second walk does not span the array
            subgraphHaplotypes: ABCA7_SAMPLES,
            walkRowSamples: ABCA7_SAMPLES,
            paneHeight: 360,
          },
        }),
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 240000,
    viewportWidth: 1400,
    viewportHeight: 745,
    hideTooltip: true,
    actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
  },

  // What `pangenome_prepare_graph` builds, drawn. That page runs five build
  // stages and carried no figure at all, so a reader finished the conversion
  // with nothing to check their own output against.
  //
  // The two BED indexes as an ordinary FeatureTrack lane, over a reference
  // window, carrying the page's own `addtrack` fence's colour jexl so the
  // figure is that fence's output rather than a prettier variant of it.
  //
  // EVERYTHING IN THIS FRAME IS BLUE, and deliberately. An rGFA tags an
  // off-reference segment with the sample contig it came from, so a query on
  // `GRCh38#0#chr6` returns rank 0 and nothing else; checked against the
  // hosted index, the C4 window is 13 rows, all rank 0. The config's rank
  // scale paints its orange interval on a sample's own lane, and its key names
  // both intervals here. So the picture's subject is the
  // TILING -- one row of segments covering the window, broken where the graph
  // branches -- and the short segments bunched at the C4 repeat are the
  // negative against the long quiet ones either side. The bubble file in the
  // next section is those break points named.
  {
    mode: 'url' as const,
    name: 'pangenome/prepare_graph_segments',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: C4_WINDOW,
          tracks: [
            hg38GeneLane(70),
            {
              trackId: SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              showLabels: 'none',
              // three rows of segments and the rank key beside them; grown to
              // the rows alone, the key clipped against the lane's bottom edge
              height: 110,
            },
          ],
        },
      ],
    }),
    // The C4 genes in the lane above, so the gate is content rather than the
    // track name the header prints before anything draws.
    readyText: 'C4A',
    readyTimeout: 180000,
    // 700 left 297 css px of blank under a two-lane view; 404 held the lane
    // grown to its rows, and the fixed 110 px lane takes 50 more
    viewportHeight: 454,
  },
  // The five amylase lanes pangenome_hprc_haplotypes chooses, cut from the gbz-base
  // track for those lanes and drawn in walk rows, in the lanes' place: each
  // bar's length is the haplotype's span across the cut, and the readout its
  // excess over GRCh38.
  {
    mode: 'url',
    name: 'pangenome/hprc_amylase_walk_rows',
    url: sessionSpec(PORTAL_CONFIG, {
      views: [
        {
          ...AMYLASE_LANES,
          tracks: [
            AMYLASE_LANES.tracks[0]!,
            graphTrack('hprc_v2_1_gbz_lanes', {
              layoutMode: 'walkrows',
              colorScheme: 'uniform',
              subgraphHaplotypes: PORTAL_LOCI.amylase.lanes,
              paneHeight: 300,
              // a bar spans the cut, so the cut stays the array's window
              maxRegionBp: cutNear(150_000),
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 240000,
    viewportWidth: 1400,
    viewportHeight: 630,
    hideTooltip: true,
    actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
  },
  // What the host page's one command writes, drawn: its four tracks over C4,
  // the graph track drawn as the graph under the other three.
  {
    mode: 'url',
    name: 'pangenome/host_your_own',
    url: sessionSpec(PORTAL_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: C4_WINDOW,
          tracks: [
            'hprc_minigraph_bubbles',
            'hprc_bubble_score',
            'hprc_minigraph_alleles',
            graphTrack(SEGMENTS_TRACK, {
              colorScheme: 'reference-position',
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 180000,
    viewportHeight: 1080,
    hideTooltip: true,
  },
]
