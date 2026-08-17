// The HPRC release 2 human pangenome figures: the minigraph-cactus graph over
// GRCh38, for the pangenome_hprc tutorial.
//
// The E. coli half of what used to be one specs/graph.ts is
// specs/graph-ecoli.ts, and the two share only what specs/graph-fixtures.ts
// holds.
import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import {
  GRAPH_DRAWN,
  TOOLBAR_READY,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'

import type {
  Annotation,
  ScreenshotAction,
  ScreenshotSpec,
} from '../screenshot-spec-types.ts'

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

// The off-reference allele the force half of pangenome/hprc_mhc_anchored
// right-clicks, named rather than measured — see HOVERED_ALLELE. `node
// scripts/probe-graph-nodes.ts pangenome/hprc_mhc_layout_force` prints the
// cut's ids with their lengths and ranks.
//
// It is 1,775 bp of HG01433 hap 2 (`CM086511.1:32,520,440-32,522,215` in the
// links index), and the two backbone segments it hangs off are s101144, ending
// at chr6:32,517,416, and s101146, starting at 32,529,437 — so the interval it
// attaches across is the 12,021 bp s101145, which is what **Highlight in hg38**
// writes into the linear view. That is also, near exactly, HLA-DRB5
// (chr6:32,517,353-32,530,287), the gene present only on DR51 haplotypes.
//
// Which is why the caption has to say it (review: "it looks like this is
// highlighting a 'black' node, instead of the green one, which is, afaict, the
// reference path"). Under the reference-position ramp black means "no reference
// position", i.e. this IS the allele the figure is about, and the green 12 kb
// node beside it is the reference segment the highlight lands on. Nothing in the
// frame joins the two, so a ring on a black node over a band 12 kb wide reads as
// the wrong node being ringed unless the words are there.
const HPRC_ALLELE = 's318599'

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
// The node's own span on CHM13, from its `SN`/`SO` tags.
const CHM13_ALLELE = { refName: 'chr17', start: 83899576, end: 84041803 }
// The node's own span padded to a round window, and it STAYS this tight
// (review: "ideally we would zoom out the lineargenomeview even more to show
// how these L1 transposons are more frequent here than elsewhere"). Not because
// there is nothing to see wider -- there is, and `hprc_l1_density_context` is
// it -- but because THIS lane cannot draw it. The RepeatMasker bigBed carries a
// long `description` per record, so past ~400 kb the lane hits its byte budget
// and comes back empty under a FORCE LOAD prompt; and per element over 627 kb
// the allele's 48 LINEs are indistinguishable from the flanks' scatter, since
// the enrichment is a level rather than a shape (0.07-0.42 inside per 20 kb
// against 0.00-0.40 outside). The wider question is answered by the density
// bigWig at ~100 kb smoothing over 3 Mb, which has neither limit.
//
// (An earlier pass concluded "no local contrast, the allele sits in a
// subtelomere that is repeat-dense end to end". That was the joined-span bug in
// build_repeat_density.sh; every number in it is roughly double.)
const CHM13_ALLELE_WINDOW = 'chr17:83,880,000-84,060,000'

// The amylase locus, framed on the inversion-flagged bubble the scan over
// hprc-v2.0-mc-grch38.bubbles.bed.gz turns up at chr1:103,611,080-103,732,636,
// with a little room either side so its flanks are on screen. 34 backbone
// segments and 113 links here, pulling 101 distinct nodes.
const AMY_WINDOW = 'chr1:103,500,000-103,850,000'
const AMY_REGION = {
  refName: 'chr1',
  assemblyName: 'hg38',
  start: 103500000,
  end: 103850000,
}

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

// The whole of chr1, for the figure that loads a subgraph over all of it. One
// constant for both views there: the graph's loadedRegion IS the domain of the
// reference-position ramp, so a second copy of these numbers is a way for the
// lane's colors and the graph's to silently disagree.
const CHR1_REGION = {
  refName: 'chr1',
  assemblyName: 'hg38',
  start: 0,
  end: 248956422,
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
// the window by scripts/build_hprc_cfhr_synteny.sh and
// scripts/build_hprc_inversion_synteny.sh. Same glyph settings as the hg38 lane
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

// UCSC's RepeatMasker on CHM13, as a session track: the fixture config carries
// no repeat annotation, and hs1 has no copy on jbrowse.org, so it comes off
// hgdownload's bigBed, which answers ranged reads with CORS in well under a
// second. (The note further down ruling hgdownload out is about a whole-file GET
// of hs1.2bit; this is a handful of index reads over a 180 kb window.) There was
// a matching hg38 lane beside it until this round — see repeatLane for the
// measurement that retired it.
const HS1_RMSK_TRACK = {
  type: 'FeatureTrack',
  trackId: 'hs1_rmsk_ucsc',
  // The colour key lives in the track NAME, not in a pill over the lane. The
  // lane is one collapsed row now, so a pill on it covers the whole thing --
  // which is what the previous round's pill did the moment the row shrank.
  name: 'RepeatMasker (T2T-CHM13v2.0), LINE elements in red',
  assemblyNames: ['hs1'],
  adapter: {
    type: 'BigBedAdapter',
    bigBedLocation: {
      uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hs1/t2tRepeatMasker/chm13v2.0_rmsk.bb',
      locationType: 'UriLocation',
    },
  },
}

// The same annotation as a DENSITY, which is the only form that can answer "is
// that a lot" at megabase scale. One class, not the multi-class lane the
// tutorial configures: the claim is about L1, and a second colour would invite
// a composition reading the window is too wide to support.
//
// Already hosted and already documented — `scripts/build_repeat_density.sh`
// writes it, the tutorial's repeat-density section is the config for it, and
// its genome mean (0.2045) is the LINE fraction of CHM13, which is the check
// that it is the corrected build rather than the joined-span one.
const HS1_LINE_DENSITY_TRACK = {
  type: 'QuantitativeTrack',
  trackId: 'hs1_line_density',
  name: 'LINE density (RepeatMasker, 5 kb bins)',
  assemblyNames: ['hs1'],
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: {
      uri: 'https://jbrowse.org/demos/hprc/repeat_density/hs1_repeat_density_LINE.bw',
      locationType: 'UriLocation',
    },
  },
}

// A repeat lane as a LIST OF ELEMENTS, not as a density strip (review: "the
// repeatmasker track is not very interesting unfortunately and looks sort of
// glitchy even, just being collapsed layout. its also too zoomed in to tell if
// this amount of repeat is significant compared to background"). Both halves of
// that are right, and the second one is what decides the first.
//
// A collapsed strip is a density read, and a density read is the one thing this
// annotation cannot support AT THIS WINDOW. scripts/build_repeat_density.sh
// puts the allele at 23.70% LINE against 14.18% and 14.47% in the CHM13
// sequence either side of it: real, and 1.7x, but only as a mean over the whole
// 142 kb. Per 20 kb the allele runs 0.07-0.42 and its flanks run 0.00-0.40, so
// over 180 kb there is no block for a strip to draw.
//
// A density read at the ALLELE'S OWN SCALE is a different matter, and it is
// `hprc_l1_density_context`: 3 Mb of the same chromosome with each drawn value
// a ~100 kb mean, where the allele is the tallest sustained level in the frame.
// Two things had to be true for that and are not true here -- the source has to
// be the density bigWig rather than this bigBed (which stops loading past ~400
// kb), and the smoothing has to be at the allele's size rather than at 5 or
// 20 kb. Earlier rounds concluded "not a picture" from inside those two limits.
//
// (An earlier pass concluded something stronger still, that there is no
// contrast at all because the allele is 84.6% repeat against flanks at 79.0%
// and 70.4%. Those were the joined-span bug in that script; every one of them
// is roughly double.)
//
// What the annotation CAN say without a density read is what the sequence is
// made of, and that is a per-element statement: 48 LINE elements in the allele's
// 142 kb, the longest a 13.6 kb L1MD. In normal layout those are individual long
// bars stacked in rows, which is the picture of a subtelomere built out of L1 —
// and it is the mechanism the lane was added for, since that is the sequence a
// BAC-and-Sanger reference had no way to place. Labels stay off: 171 repeat
// names over 180 kb is a wall of small print, and the classes are the caption's
// business.
function repeatLane(trackId: string) {
  return {
    trackId,
    type: 'LinearBasicDisplay',
    // COLLAPSED, which is a height decision and costs this lane nothing (review:
    // "also try to extensively reduce y-screen real estate on left side"). The
    // labels are already off and what the lane is read for is how much of the
    // interval is red, so packing 171 elements into rows that avoid overlap was
    // spending ~150 px on a layout nobody reads: collapsed draws them all on one
    // row, and an overlap between two repeat elements is a couple of bases.
    displayMode: 'collapsed',
    showLabels: 'none',
    // LINE red, everything else grey, off the class the bigBed writes into the
    // name after a '#' (`L1MD1#LINE/L1`). Two colors rather than one per class:
    // the finding is that one class builds this interval, so a per-class palette
    // would spend a legend on the four that do not. It is also what lets the
    // labels stay off — a bar's color says its class without a name on it.
    color:
      "jexl:includes(get(feature,'name'),'#LINE') ? 'rgb(200,60,45)' : 'rgb(158,158,158)'",
    // grow, so the band is whatever one collapsed row needs rather than a
    // number picked in advance
    heightMode: 'grow',
    height: 90,
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
// identification themselves -- which is what let the numbered badges that used
// to sit on them come off when the pair was reported as too busy. Anchored by
// id, so each layout can put them where it likes.
// ONE, not two (review: "why are there three circles? try to just use the one
// circle for the green path"). The pair was the reference node and the allele
// over it, and on the force half those two are drawn touching, so their rings
// overlapped and the reader was counting circles rather than reading them.
//
// The one kept is s101145+, the rank-0 node -- the green one, under the
// reference-position ramp -- and it is the right survivor for a reason beyond
// the count: it is also the interval **Highlight in hg38** writes into the
// linear view, so on the force half the ring, the menu item boxed under it and
// the orange band above are three views of one object instead of three
// unrelated marks.
const MHC_LANDMARK_NODES = ['s101145+']

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
function mhcLayoutPartSpecs(): ScreenshotSpec[] {
  // One object rather than seven positional arguments: the two calls below
  // differ in six of them, and read as a list of bare numbers and offsets
  // otherwise -- `('…_force', 'force', 895, 520, { dx: 180, dy: -276 }, …)`
  // says nothing about which number is a viewport and which a pane.
  const part = ({
    name,
    layoutMode,
    viewportHeight,
    // Only the force half sets one. See the call below for why, and for the
    // measurement; omitting it leaves the pane sizing itself, which is what the
    // anchored half wants (its height is its rank count).
    paneHeight,
    // The force half additionally carries the right-click route, which used to
    // be pangenome/hprc_node_menu, a whole second capture of this same window
    // and this same drawing (reviewer: "may not need standalone figure combine
    // with pangenome/hprc_mhc_anchored"). What it added over this half was the
    // menu, one ring and the band the menu leaves behind, so it is those three
    // things rather than a figure.
    nodeMenu,
  }: {
    name: string
    layoutMode: 'auto' | 'force'
    viewportHeight: number
    paneHeight?: number
    nodeMenu?: {
      actions: ScreenshotAction[]
      annotations: Annotation[]
    }
  }): ScreenshotSpec => ({
    mode: 'url',
    name,
    ...(nodeMenu ? { actions: nodeMenu.actions } : {}),
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
          tracks: [hg38GeneLane(70), hprcSegmentsLane(MHC_REGION)],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: MHC_REGION,
          layoutMode,
          colorScheme: 'reference-position',
          ...(paneHeight === undefined ? {} : { paneHeight }),
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
    // FOUR RED MARKS ON THE FORCE HALF, DOWN FROM SEVEN (review: "the red
    // annotations are too messy here. reduce"). Two things came off, and each
    // was redundant with something already drawn in the frame by the app:
    //
    // - THE NUMBERED BADGES. Two rings plus two badges landed inside one 60 px
    //   corner of the force pane, because the landmarks are an allele and the
    //   reference stretch it replaces and that layout draws them touching --
    //   which is why the badges needed opposite dx/dy there and a special case
    //   for the caption pill. What they were for is telling the reader that a
    //   ring on the left is the same node as a ring on the right, and the graph
    //   already writes each node's length beside it in BOTH layouts (`12 kb`
    //   and `12.3 kb`, the two longest nodes in the cut). The rings stay; the
    //   labels doing the identifying are the app's own.
    // - THE PER-HALF CAPTION PILL. It said "The same subgraph, force-directed"
    //   over a pane whose Layout dropdown, in frame and unobscured, reads
    //   "Force-directed layout". `label`/`labelOffset` went with it, and with
    //   them the note about the two layouts leaving their whitespace in
    //   different places -- there is nothing left to place.
    //
    // What is left is the two landmark rings, and on the force half the third
    // ring plus the boxed menu item, which are the right-click route.
    annotations: [
      ...MHC_LANDMARK_NODES.map((graphNode): Annotation => ({
        type: 'circle',
        anchor: { view: 1, graphNode },
        radius: 24,
        strokeWidth: 3,
      })),
      ...(nodeMenu?.annotations ?? []),
    ],
  })
  return [
    // the top strip of the force pane: its nodes start well below the top of
    // the canvas, so nothing is covered there
    part({
      name: 'pangenome/hprc_mhc_layout_force',
      layoutMode: 'force',
      // 458 css px of app chrome plus the pane below, measured off the run's
      // own below-the-fold report at paneHeight 520 (978 - 520).
      viewportHeight: 878,
      // 420 rather than the MAX_CANVAS_HEIGHT ceiling of 600 this pinned
      // (review: "try to reduce height of graphgenomeview on left side"). The
      // force drawing here is tall and narrow -- a chain that turns down the
      // pane and ends in a 9.4 kb loop -- so the aspect-derived height is well
      // over the ceiling and the pane took all of it. `paneHeight` replaces the
      // ceiling (the MIN_CANVAS_HEIGHT floor of 160 still wins), the drawing
      // auto-fits smaller, and the node labels are drawn at a fixed size, so
      // they stay the size they were. Same value as hprc_chm13_allele, which
      // was measured over the same trade.
      //
      // It also squares the composite from the other end. `+append` pads the
      // shorter part, and the note on the anchored half below records that
      // raising THAT one to 1055 only adds blank page inside it, because its
      // pane sizes to its own rank count. Bringing this one down to 878 closes
      // most of the same gap by shrinking the part that was actually taller.
      paneHeight: 420,
      // THE RIGHT-CLICK ROUTE, folded in from the deleted hprc_node_menu.
      // `Highlight in hg38` writes the node's reference interval into the
      // linear view's own highlight list, where it stays — which is what lets
      // one frame carry both the menu and its result: click the item, then
      // right-click the same node again, so the menu stands over a band it
      // already left behind. The node is NAMED (`anchor: { graphNode }`,
      // resolved through the view's nodePositions), so a layout change fails
      // the capture rather than clicking empty canvas.
      nodeMenu: {
        actions: [
          // the auto-fit has to have finished before the anchor means anything
          { type: 'delay', ms: 2000 },
          { type: 'rightclick', anchor: { view: 1, graphNode: HPRC_ALLELE } },
          { type: 'waitForText', text: 'Highlight in hg38' },
          { type: 'click', text: 'Highlight in hg38' },
          { type: 'delay', ms: 1500 },
          { type: 'rightclick', anchor: { view: 1, graphNode: HPRC_ALLELE } },
          { type: 'waitForText', text: 'Node details' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          // The ring that used to sit on HPRC_ALLELE, the node the menu was
          // opened on, is GONE with the second landmark. A context menu opens
          // AT the cursor, so its own position already says which node it was
          // opened on, and what the frame needs marked is where the result
          // LANDS -- which is the one remaining ring, since `Highlight in hg38`
          // writes s101145's interval and not the clicked node's.
          //
          // the item that produced the band. Without it the frame holds a menu
          // and a highlight with nothing joining them.
          { type: 'box', anchor: { text: 'Highlight in hg38' } },
        ],
      },
    }),
    // the one-hop default cut brings in more nodes than the old None cut, so
    // the anchored pane grew past the 775 this used to need.
    //
    // DO NOT try to square the composite by raising this to the force half's
    // 1055. `+append` pads the shorter panel, so the pair does carry a white
    // slab under this side — but the slab is the graph PANE being shorter, not
    // the capture being shorter, and the pane sizes itself to its own content.
    // Rendered at 1055: the composite came out pixel-identical in its app frames
    // and the extra 265 css px landed as blank page inside this part, which the
    // run then reports as "blank below the last content". It also does not buy
    // the zoom this half would like — the anchored layout stayed at 1.2%,
    // because it fits to the pane and the pane did not grow.
    part({
      name: 'pangenome/hprc_mhc_layout_anchored',
      layoutMode: 'auto',
      // 705, down from 790: the 85 css px the run reported blank under this
      // part is exactly what the per-half caption pill used to occupy. The
      // composite is unaffected either way -- `+append` pads this half up to
      // the force half's 878 regardless -- but this part is its own figure with
      // its own live link.
      viewportHeight: 705,
    }),
  ]
}

// ---------------------------------------------------------------------------
// What website/scripts/video-specs.ts films on this dataset
// ---------------------------------------------------------------------------
//
// THE TOUR STARTS WITH NO HPRC TRACK IN THE SESSION, which is the whole reason
// it has a config of its own. `hprc.json` already carries
// `hprc_minigraph_segments`, and `doPasteConfigSubmit` rejects a pasted config
// whose `trackId` is taken rather than merging it — so a tour filmed against
// the figures' config could not add the track the figures use. `hprc_tour.json`
// is that config with the HPRC tracks removed: hg38, its genes, and the plugin.
//
// It is also the tour's live link (videoLiveUrls), and that is the stronger
// half of the trade. A figure's link opens the state the figure shows; a tour's
// opens the state the tour STARTS in, so a reader who has just watched the
// route can take it, paste the same block, and end up where the clip ended.
const HPRC_TOUR_CONFIG = local('test_data/graphgenomeview/hprc_tour.json')

// The reader's window before they cut anything: wide enough that narrowing to
// the class II locus is a visible move, narrow enough that the fine segments
// index draws (it is one feature per graph SEGMENT, so a megabase is a mat).
const TOUR_OPENING_WINDOW = 'chr6:32,400,000-32,700,000'

// WHAT THE TOUR TYPES INTO THE PASTE BOX, and it is `pangenome_hprc.md`'s own
// "Load the graph" fence character for character. A reader watching the clip is
// meant to recognise the block above it on the page, so the two are one text:
// change the fence and change this in the same commit.
//
// It carries `assemblyNameToPanSN`, which is the reason this track cannot be
// added the ordinary way. `Add a track from file or URL` guesses an adapter
// from a file extension and offers no adapter options, so a graph whose
// segments are named `GRCh38#0#chr6` has nowhere to say which loaded assembly
// that prefix means. Pasting the config is the route, which is what makes it
// worth filming rather than describing.
export const HPRC_SEGMENTS_TRACK_JSON = `{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_segments",
  "name": "HPRC release 2 graph (rGFA segments)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  },
  "displayDefaults": {
    "color": "jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'"
  }
}`

// The locus the tour navigates to before it launches a graph, and the window
// every MHC figure on the page is cut from. Typed into the location box rather
// than opened at: the drawer that carries the paste box takes ~400 px off the
// linear view while it is open, and an LGV keeps its bp-per-pixel across a
// resize, so the window a session opened at is not the window standing when the
// drawer closes. The launch reads `dynamicBlocks`, so without this step the cut
// is whatever the drawer left behind — and TOUR_NODE, which the tour
// right-clicks by id, is an id THIS window's cut returns.
export const TOUR_MHC_LOCUS = 'chr6:32,500,000-32,560,000'

// The node the tour right-clicks, which is the node the force half of
// pangenome/hprc_mhc_anchored opens its menu on: the 1.8 kb HG01433.2 allele
// over HLA-DRB5. HPRC_ALLELE above carries the whole account, including why
// `Highlight in hg38` marks a different node than the one clicked.
export const TOUR_NODE = HPRC_ALLELE

// The state the tour opens in: hg38 and its genes, nothing of the pangenome
// yet. The gene lane is the figures' own, so the track that arrives mid-tour
// lands under the same annotation the rest of the page draws it under.
export function hprcTourSession() {
  return sessionSpec(HPRC_TOUR_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: TOUR_OPENING_WINDOW,
        tracks: [hg38GeneLane(70)],
      },
    ],
  })
}

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
            jexlFilters: SV_FILTER,
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

export const hprcGraphSpecs: ScreenshotSpec[] = [
  // A WHOLE HUMAN CHROMOSOME AS A GRAPH. This is the scale claim, and the two
  // numbers that make it are in the header: 249 Mb of GRCh38 chr1, drawn from
  // the hosted level-of-detail tier.
  //
  // The tier is one node per BUBBLE rather than one per segment
  // (scripts/build_bubble_tier.sh over the `gfatools bubble` decomposition HPRC
  // publishes, hosted as hprc-v2.0-mc-grch38.tier10000.*). Measured off that
  // file: 474 nodes for all of chr1, against ~751k segments in the graph and
  // 3,034 for 5 Mb of the FINE index, which is already undrawable. So this is
  // not the same picture zoomed out — it is a different granularity of the same
  // graph, and the fine index is what the locus figures on this page use.
  //
  // maxRegionBp is why it can be drawn at all. The view's bp ceiling is 5 Mb,
  // which is a proxy for node count and a good one only at fine granularity; a
  // tier breaks the proxy, so a session pointed at one says so. maxGraphNodes
  // is untouched and still counts what actually came back. Needs the plugin
  // bundle pinned at aee5e17f4b2c or later.
  //
  // The segments lane above is the same tier file as an ordinary FeatureTrack,
  // which is the other half of the claim: at 249 Mb the FINE segments track
  // refuses with "Too many features", and this one draws.
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
        {
          type: 'FeatureTrack',
          trackId: 'hprc_tier',
          name: 'HPRC release 2 graph: bubble tier (one node per bubble)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'RgfaTabixAdapter',
            uri: 'https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.tier10000',
            assemblyNameToPanSN: { hg38: 'GRCh38' },
          },
        },
        // The same bubble file the tier was built FROM, as a curve. This costs
        // no new data and no new code: MinigraphBubbleAdapter already sets
        // `score` to the bubble's segment count, and it extends
        // BaseFeatureDataAdapter, which supplies getRegionQuantitativeStats off
        // `scoresToStats` — so a wiggle display gets its axis by scanning the
        // features it already reads. The only change is the track TYPE, since a
        // FeatureTrack does not offer a wiggle display to choose.
        //
        // 9,444 bubbles on chr1, segment counts into the hundreds, so at 249 Mb
        // each pixel aggregates a handful and the profile is real rather than
        // sampled.
        {
          type: 'QuantitativeTrack',
          trackId: 'hprc_bubble_score',
          name: 'HPRC release 2 graph: variability (segments per bubble)',
          assemblyNames: ['hg38'],
          adapter: {
            type: 'MinigraphBubbleAdapter',
            uri: 'https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz',
            assemblyNameToPanSN: { hg38: 'GRCh38' },
          },
        },
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
            {
              trackId: 'hg38_cytobands_ucsc',
              type: 'LinearBasicDisplay',
              displayMode: 'collapsed',
              showLabels: 'none',
              // The Giemsa stain, which is column 5 of UCSC's cytoBand BED and
              // lands on `score` positionally (`chr1 125100000 143200000 q12
              // gvar`). Uncoloured the lane is one gold bar 249 Mb long and
              // says nothing; with the stain it is the ideogram, on the same
              // axis as the bubbles -- and the two bands the callouts name are
              // the two that are not grey: acen for the centromere and gvar
              // for 1q12.
              color:
                "jexl:get(feature,'gieStain')=='acen' ? 'rgb(190,50,50)' : " +
                "get(feature,'gieStain')=='gvar' ? 'rgb(120,120,200)' : " +
                "get(feature,'gieStain')=='stalk' ? 'rgb(100,160,100)' : " +
                "get(feature,'gieStain')=='gneg' ? 'rgb(235,235,235)' : " +
                "get(feature,'gieStain')=='gpos25' ? 'rgb(190,190,190)' : " +
                "get(feature,'gieStain')=='gpos50' ? 'rgb(150,150,150)' : " +
                "get(feature,'gieStain')=='gpos75' ? 'rgb(110,110,110)' : 'rgb(70,70,70)'",
              height: 30,
            },
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
              // The graph pane's own reference-position ramp, over the same
              // 249 Mb the subgraph is cut from, so a block up here and the
              // node it is is the same color (review: "the canvas nodes are not
              // rainbow colored like the graph is"). Same helper the LPA and
              // MHC segment lanes use; this lane simply never got it.
              color: referencePositionColor(CHR1_REGION),
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
        {
          type: 'GraphGenomeView',
          loadedTrackId: 'hprc_tier',
          loadedRegion: CHR1_REGION,
          // the whole point: 249 Mb past the 5 Mb default
          maxRegionBp: 250000000,
          // ANCHORED, and the Bandage force drawing was TRIED here rather than
          // declined on another figure's measurement (review: "please try the
          // bandage graph. humor me"). It does not work, and the reason is in
          // the pane's own header: 474 nodes and 473 edges. n-1 edges on a
          // connected drawing is a PATH -- the tier is one node per bubble in
          // reference order with one edge between consecutive bubbles, so every
          // branch the graph had was collapsed away when the tier was built.
          // A force layout of a path is a long wiggly line; rendered, it fills
          // the pane with one arc at 4.2% zoom and runs off both edges, and
          // nothing about the chromosome is legible in it. The anchored layout
          // of the same path is the reference axis, which is the one thing the
          // drawing has to say at this scale. Bandage's own subject -- where the
          // graph branches -- is what the locus figures on this page draw, on
          // the fine index.
          layoutMode: 'auto',
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 300000,
    settleMs: 15000,
    viewportWidth: 1400,
    // the cytoband lane, the loci lane, the variability curve, the tier lane,
    // and a two-row anchored drawing. +90 for the loci lane, its header and the
    // row its labels take, which is 25 more than the lane's own height.
    viewportHeight: 823,
    hideTooltip: true,
    // The blank is the loudest thing in the picture and nothing on the image
    // said what it was. The caption used to call it the centromere and 1q12,
    // which is both something a reader has to already know and not what the
    // files say: bubbles ARE called across the centromere (21 in the 124th Mb,
    // 40 in the 125th). The continuous blank runs 125,183,471 to 143,314,415 in
    // the bubbles BED, and the tier BED carries exactly one node over it —
    // `bb_GRCh38#0#chr1_125178636`, 125,178,636-143,831,879, which is the
    // 18.7 Mb the graph pane labels. That is GRCh38's own heterochromatin gap
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
  // pangenome/hprc_node_menu was here and is DELETED (reviewer: "may not need
  // standalone figure combine with pangenome/hprc_mhc_anchored"). It was the
  // same window, the same tracks and the same force drawing as that pair's left
  // half, with a menu, one ring and the band the menu leaves behind on top —
  // so those three things moved onto the half itself (see mhcLayoutPartSpecs)
  // and the second capture of the MHC subgraph went away. The claim they carry
  // is unchanged: `Highlight in hg38` on a 1.8 kb HG01433.2 allele writes the
  // 12 kb GRCh38 backbone segment it attaches across, which is HLA-DRB5,
  // because an off-reference node is drawn over the reference it replaces and
  // never over its own length.
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
            // the C4A/C4B duplication is why the lane is collapsed here: at
            // the default glyph mode it stacks deep enough that the last row
            // is clipped by the one below it
            hg38GeneLane(70),
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
          // The carrier's band is where the event is — a ribbon that stops and
          // resumes around the highlighted span — and the non-carrier's is one
          // ribbon straight through it, which needs less height to be read
          // (review: "the third row just looks like normal non interesting
          // alignment"). It is the row's GENE LANE that earns its keep, not its
          // ribbon: CFHR3 and CFHR1 annotated there are what make their absence
          // from the carrier a deletion rather than a gap in CAT's annotation of
          // one assembly.
          levelHeights: [110, 70],
          collapseEmptyRows: true,
          views: [
            {
              assembly: CFHR_CARRIER,
              loc: CFHR_CARRIER_WINDOW,
              tracks: [haplotypeGeneLane(CFHR_CARRIER_GENES)],
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
              tracks: [hg38GeneLane(70), hprcSegmentsLane(CFHR_REGION)],
            },
            {
              assembly: CFHR_NONCARRIER,
              loc: CFHR_NONCARRIER_WINDOW,
              tracks: [haplotypeGeneLane(CFHR_NONCARRIER_GENES)],
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
    // of backbone: the anchored pane came out 238 px shorter. Then 118 shorter
    // again when a row became a 20 px pitch rather than a fraction of the drawn
    // width — the run's own `blank below the last content` number, not measured
    // off the image. Standalone, so unlike the two composed pairs in this file
    // there is no taller sibling that would just absorb the trim as padding.
    viewportHeight: 1184,
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
                  jexlFiltersSetting: ['jexl:feature.inversion'],
                  height: 60,
                },
                hprcSegmentsLane(INV_REGION),
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
    // the synteny canvas, not TOOLBAR_READY: this is the one HPRC figure with no
    // graph pane, so the plugin's toolbar never appears
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
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
  // The amylase locus on chr1, which is the figure for "this scales to a whole
  // chromosome". chr1 is 248 Mb and the graph holds 464 haplotypes of it; the
  // view fetches this 350 kb window out of two tabix indexes and draws 126
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
  //
  // 350 kb, not the 145 kb of the bubble itself (review: "frankly pretty chaotic
  // ... zooming out and showing more graph context could help particularly if
  // this is just a localized complex region"). It is, and the wider cut is what
  // shows it: the flanks are one chain of backbone segments running the width of
  // the pane, and every crossing in the drawing is inside the AMY bubble at the
  // end of it. On the 145 kb cut that chain was off-frame, so the tangle filled
  // the pane and had nothing to be localized against.
  //
  // Measured rather than picked: 550 kb (145 nodes) draws the same shape at
  // 20% zoom-to-fit against 27%, so the knot is smaller for one more backbone
  // segment either side; `bubbleSpread: 'open'` on top of either window floors
  // every node's drawn length and inflates the whole drawing, which puts
  // zoom-to-fit at 11% and closes the bubbles it was meant to open. Both
  // rendered.
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
            hg38GeneLane(70),
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
          // FMMM's iteration budget at its top setting (120 + 60 against the
          // model default's 15 + 10), which is what untangles the backbone into
          // the single chain the figure now turns on. Milliseconds at this size,
          // stated by the header's own layout timing.
          layoutQuality: 4,
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    settleMs: 8000,
    // The zoom-to-fit repaint, which the toolbar gate does not cover and which
    // this cut is big enough to lose: the labels are DOM and move with the new
    // transform immediately, the canvas repaints a frame later, so a capture in
    // between is a pane of labels with the strokes still drawn at the old scale
    // in one corner. Reproduced in 3 of the 4 renders here before this wait,
    // and in none of the 3 after it.
    actions: [{ type: 'delay', ms: 4000 }],
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
  // an ordinary interval and the same segments track draws it as one feature.
  //
  // A REPEATMASKER LANE ON THE CHM13 PANE, which is what the figure is otherwise
  // missing (review: "there is no gene in this region, but if some other track
  // would help potentially explain why this was missed in hg38 e.g. repeats can
  // add that"). There is no gene, and there is no assembly gap either -- UCSC's
  // hg38 `gap` track has one record past 82.5 Mb on chr17 and it is the terminal
  // 10 kb telomere, so this is a real insertion allele rather than a hole GRCh38
  // never closed. What the lane shows is the mechanism: the inserted 142 kb
  // carries 48 LINE elements, 23.70% of it against 14.18% and 14.47% in the
  // CHM13 sequence either side, and the longest is a 13.6 kb L1MD -- a stack of
  // L1, which is the sequence a BAC-and-Sanger reference had no way to place.
  //
  // ONE lane, where there were two, and not a collapsed density strip: see
  // repeatLane for the measurement that decided both.
  //
  // The bottom pane's gene lane is GONE with it, for the reason the top pane
  // never had one: `jbrowse.org/ucsc/hs1/hs1.gff.gz` has nothing in this window,
  // so it was 70 px of empty lane under a caption about a 142 kb insertion.
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
    name: 'pangenome/hprc_chm13_allele_panes',
    url: sessionSpec(HPRC_CONFIG, {
      sessionTracks: [HS1_RMSK_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          // Which pane is which, in the app rather than over it (review: "might
          // want text annotation toward the top that says HG38 and text
          // annotation at the bottom that says T2T-CHM13v2.0"). A view header
          // falls back to its assembly names, which read `hg38` and
          // `Human (T2T-CHM13v2.0/hs1)` and are easy to miss between three
          // panes; naming all three, graph included, leaves no `Untitled view`
          // in the middle of the stack.
          displayName: 'hg38 (GRCh38) — no coordinates for this sequence',
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
              // one two-line label on one row; 60 was sized when the lane was
              // unfiltered
              height: 46,
            },
            // no repeat lane on THIS pane, where there used to be one on each.
            // Two lanes is a comparison, and the comparison was the part that
            // could not be read (see repeatLane): 41 elements scattered over
            // 30 kb here against a near-solid strip over 180 kb there is a
            // difference in bp/px before it is a difference in repeat. The lane
            // below stands on its own as what the inserted sequence is made of.
            hprcSegmentsLane(CHM13_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          displayName: 'HPRC release 2 graph, cut from the window above',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: CHM13_REGION,
          layoutMode: 'force',
          colorScheme: 'reference-position',
          // 420 rather than the 600 px ceiling this pane pinned (reviewer: "we
          // might want to consider ways to reduce height of the graph genome
          // viewer, it takes a lot of height"). The pane is as tall as the
          // drawing's own aspect ratio, and one 142 kb node among sub-kb ones
          // makes that ratio all arc, so most of the 600 went to the loop with
          // the chain squashed along the bottom edge. Measured at 420: the
          // drawing scales 24.6% to 16.1%, the boxed arc is still what the eye
          // lands on and the chain stays legible. `paneHeight` is a plugin prop
          // (published bundle 35eccae5db30); the floor at MIN_CANVAS_HEIGHT
          // still wins, so this cannot squeeze the pane below hover height.
          //
          // 320 now, from 420 (review: "also try to extensively reduce y-screen
          // real estate on left side"). Same reasoning one notch further: what
          // the pane is read for is the boxed arc against the chain it leaves
          // and rejoins, and both survive the scale change because the drawing
          // is fitted rather than cropped.
          paneHeight: 320,
        },
        {
          type: 'LinearGenomeView',
          displayName: 'T2T-CHM13v2.0 (hs1) — an ordinary interval',
          assembly: 'hs1',
          loc: CHM13_ALLELE_WINDOW,
          // the node's own span, drawn by the app from its coordinates rather
          // than painted over the capture
          highlight: [{ ...CHM13_ALLELE, color: 'rgba(60,65,72,0.10)' }],
          tracks: [
            repeatLane(HS1_RMSK_TRACK.trackId),
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
    // 1078, off the run's own blank-below-the-content report, after three
    // height cuts asked for by the same review note: the graph pane 420 -> 320,
    // the repeat lane to one collapsed row, and the bubble lane to the one row
    // its filter leaves.
    viewportHeight: 1078,
    hideTooltip: true,
    annotations: [
      {
        type: 'box',
        anchor: { view: 1, graphNode: CHM13_NODE },
        strokeWidth: 3,
      },
      // THE LOOP CARRIES THE BADGE TOO (review: "presumably the loop should
      // also be labeled with '1'"). It is the same object as the bar in the
      // pane below and the shaded column in the part beside this one, and it
      // was the only one of the three drawn without the number. A graph-node
      // anchor resolves to a point ON the node's polyline rather than to its
      // bounding box, so the badge lands on the arc itself -- which is what
      // makes it a label on the loop and not on the box around it.
      {
        type: 'circle',
        text: '1',
        anchor: { view: 1, graphNode: CHM13_NODE },
      },
      // WHICH PANE IS WHICH, OVER THE APP AS WELL AS IN IT (review: "the in-app
      // texts are too small to see. we need to add them"). Each pane already
      // carries a `displayName`, which is what an earlier round asked for, and
      // a view header draws it at 13 css px in a 1000 px frame that is 2,630 px
      // tall -- correct, and not what the eye lands on. These repeat the pane
      // headers at 18 px in each pane's own empty corner. If a header is
      // reworded, reword the overlay with it -- EXCEPT the graph pane's, which
      // deliberately says something the header does not; see below.
      {
        type: 'text',
        text: 'hg38: no coordinates for this sequence',
        fontSize: 18,
        maxWidth: 320,
        // RIGHT, where the filtered bubble lane is empty. On the left it sat on
        // the one bubble the filter keeps and on the segment blocks under it.
        textAlign: 'end',
        anchor: {
          view: 0,
          track: 'hprc_minigraph_bubbles',
          fracY: 0,
          alignX: 'right',
          dx: -16,
          // the track rect starts at its HEADER, so dy has to clear the
          // "HPRC release 2 bubbles" row before the lane's own whitespace
          dy: 30,
        },
      },
      // THE GRAPH PANE'S OVERLAY IS NOT ITS HEADER (review: "the text annotation
      // 'cut to that window' is meaningless"). It was, and the header is where
      // that belongs: which interval the subgraph was cut from is a fact about
      // the pane, and repeating it at 18 px spent the pane's one free corner
      // saying nothing twice. What the pane cannot say for itself is why one
      // node is charcoal in a rainbow: `reference-position` ramps hue across the
      // window the cut came from and drops any segment with no reference
      // coordinate off the ramp entirely (graph_genome_view.md, "Colors that
      // mean the same thing in both panels"). So the boxed arc is grey for
      // exactly the reason the pane above it carries no coordinates for that
      // sequence -- one claim, stated once per pane in each pane's own terms.
      //
      // PLURAL on purpose: the boxed arc is the largest charcoal node, not the
      // only one. The chain carries a dozen small grey segments between the
      // coloured ones, which is the same statement at a scale that does not
      // need a box.
      {
        type: 'text',
        text: 'charcoal nodes have no hg38 coordinate',
        fontSize: 18,
        maxWidth: 320,
        anchor: {
          selector: '[data-testid="graph-genome-canvas"]',
          alignX: 'left',
          alignY: 'top',
          dx: 16,
          dy: 10,
        },
      },
      // The pane's colour-key pill is GONE, into the track's own name (see
      // HS1_RMSK_TRACK). It used to carry three things -- which assembly, what
      // red means, and 23.7% against 14% either side -- and two of them had to
      // go for different reasons. The percentages are a measurement a reader
      // cannot check against the picture, which is what the density part beside
      // this one is for and what website/CLAUDE.md now says about callouts. The
      // rest is a label, and a label belongs on the track.
      // HALF OF THE PAIR ①, whose other half is on the density part. The two
      // parts are side by side and this is the one landmark they share: the
      // sequence this pane draws per repeat element is the sliver shaded over
      // there. See the density part for why a badge and not an arrow.
      //
      // On the SEGMENTS lane rather than the RepeatMasker one above it, because
      // the segments lane draws the allele as a single feature -- the badge sits
      // on one bar that is exactly the thing being identified, where on the
      // repeat lane it would land in the middle of eight rows of elements.
      // In the 20 kb of flank LEFT of the bar rather than on it, with an arrow
      // to where the bar starts (review: "make arrow pointing from the badges").
      // On the bar the badge was a disc on a black rectangle that runs most of
      // the pane, so it identified the lane rather than the allele; beside it,
      // with the arrow landing on the allele's own left edge, it identifies the
      // feature. Both ends are locus anchors on the same track, so neither is a
      // measured pixel.
      {
        type: 'circle',
        text: '1',
        anchor: {
          view: 2,
          track: SEGMENTS_TRACK,
          locus: 'chr17:83,886,000',
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          view: 2,
          track: SEGMENTS_TRACK,
          locus: 'chr17:83,886,000',
          dx: 20,
        },
        anchor: {
          view: 2,
          track: SEGMENTS_TRACK,
          locus: 'chr17:83,899,576',
        },
      },
    ],
  },
  // PART TWO: IS THAT A LOT? (review, on the part above: "we keep relitigated
  // this but im trying to understand, what would convince user this is like an
  // abnormal number of L1 compared to an even larger e.g. megabase scale
  // region"). Nothing in that part can answer it: its widest lane is 180 kb, so
  // the allele has only itself and two slivers of flank to be dense against,
  // and the pill's "23.7% vs 14%" is a pair of numbers a reader has to take on
  // trust. This is the same measurement drawn at the scale the question is
  // asked at, and it is a PART rather than a figure of its own so that the
  // claim and its check cannot be read apart.
  //
  // Three earlier rounds concluded there was no picture here, and each was
  // looking at the wrong two things: the ELEMENT lane, which cannot go past
  // ~400 kb before the RepeatMasker bigBed hits its byte budget, and 20 kb
  // bins, at which the allele runs 0.07-0.42 and its flanks 0.00-0.40 and
  // nothing separates. The density bigWig has neither limit, and at the
  // ALLELE'S OWN SCALE the separation is not subtle: `build_repeat_density.sh`
  // ranks it against every 142 kb window of CHM13 and finds 2 of the 262 within
  // 5 Mb carry more LINE, against a local median of 0.084.
  //
  // AND IT IS SCOPED, which is the honest half of the answer: genome-wide the
  // same 23.7% is ordinary, with 35% of 142 kb windows above it. So the figure
  // is 3 Mb of chr17 rather than a chromosome or a genome, and the caption says
  // which claim is being made.
  //
  // `resolution` is what does the smoothing, and it is the whole trick: the
  // display asks the bigWig for values of `bpPerPx / resolution` bp, so 0.03
  // over this window lands on a ~100 kb zoom level instead of the ~3 kb one the
  // default would draw. At 3 kb the allele is invisible inside the spikes -- 5
  // kb bins reach 0.73 inside it and 0.47 just outside.
  {
    mode: 'url',
    name: 'pangenome/hprc_chm13_allele_density',
    url: sessionSpec(HPRC_CONFIG, {
      sessionTracks: [HS1_LINE_DENSITY_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          displayName: 'T2T-CHM13v2.0 (hs1) chr17, the last 3 Mb',
          assembly: 'hs1',
          // to the end of the chromosome: the allele sits 235 kb from the
          // telomere, so a window centred on it would be half off the contig
          loc: 'chr17:81,300,000-84,276,897',
          // the allele's own span, drawn by the app from its coordinates
          highlight: [{ ...CHM13_ALLELE, color: 'rgba(200,60,45,0.16)' }],
          tracks: [
            {
              trackId: HS1_LINE_DENSITY_TRACK.trackId,
              type: 'LinearWiggleDisplay',
              defaultRendering: 'xyplot',
              useBicolor: false,
              resolution: 0.03,
              // 'avg' EXPLICITLY. A zoom level stores min/mean/max per bin and
              // the default draws all three as whiskers, so the first render
              // was a pale max band filling the lane to 0.5 everywhere with the
              // mean buried under it -- the opposite of the point. The mean is
              // the density; the max of a 100 kb bin is whatever single 5 kb
              // bin inside it happened to be an L1.
              summaryScoreMode: 'avg',
              // fixed, not autoscaled: an axis that ends at whatever this
              // window happens to reach cannot be read against another window,
              // and 0.5 keeps the plateau at half height rather than pinned to
              // the top of the lane
              minScore: 0,
              maxScore: 0.3,
              displayCrossHatches: true,
              // Sized to the column it sits beside rather than to the lane's own
              // needs: the compose is horizontal, so this part's height is the
              // panes part's 1,331 and the only question is what fills it. 220
              // was right when this was stacked UNDER 2,662 px of panes and every
              // pixel was one the reader had to scroll past; beside them, a short
              // lane just leaves white. The axis is fixed at 0-0.3 either way, so
              // the extra height is resolution on the one comparison the part
              // exists to make -- the shaded plateau against the 3 Mb around it --
              // and the crosshatches keep it readable rather than a wall of bars.
              //
              // 828 now, following the panes column down (review: "the right
              // side does not need to be that turbo tall"). This lane never
              // wanted the height on its own account -- it is one bar chart on a
              // fixed 0-0.3 axis -- so every pixel the left column gives back is
              // one this one gives back too.
              height: 828,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('wiggle-display'),
    readyTimeout: 90000,
    settleMs: 6000,
    viewportWidth: 1000,
    // the panes part's viewportHeight exactly. `+append` pads the shorter part
    // to the taller one and top-aligns it, so any mismatch here is white down
    // the bottom of this column rather than an error.
    viewportHeight: 1078,
    hideTooltip: true,
    annotations: [
      {
        type: 'text',
        text: 'the 142 kb insertion allele',
        fontSize: 17,
        anchor: {
          track: HS1_LINE_DENSITY_TRACK.trackId,
          locus: 'chr17:83,899,576',
          fracY: 0.06,
          alignX: 'left',
          dx: -14,
        },
        textAlign: 'end',
      },
      // AND IT POINTS (review: "make arrow pointing from the badges"). The pill
      // sat beside the shaded column naming it, which at 3 Mb across 1000 px is
      // a label a few pixels from two other bars just as tall. Tail at the
      // pill's own locus, head on the allele's midpoint further down the lane,
      // both resolved through the track rather than measured.
      {
        type: 'arrow',
        fromAnchor: {
          track: HS1_LINE_DENSITY_TRACK.trackId,
          locus: 'chr17:83,899,576',
          fracY: 0.1,
          dx: -24,
        },
        anchor: {
          track: HS1_LINE_DENSITY_TRACK.trackId,
          locus: 'chr17:83,970,690',
          fracY: 0.28,
        },
      },
      // HALF OF THE PAIR ①. The other half is on the panes part's bottom pane,
      // and together they say that the shaded sliver here is the sequence drawn
      // per repeat element over there. It has to be a badge rather than the
      // arrow the pairing wants: compose parts are separate captures `+append`ed
      // afterwards, so nothing can be drawn across the seam (see ComposeSpec).
      //
      // Anchored to the allele's own span on the track, so it stays on the
      // sliver as the lane's height changes; `fracY: 0.5` puts it at the lane's
      // middle, below the label above and clear of the plateau's own bars.
      {
        type: 'circle',
        text: '1',
        anchor: {
          track: HS1_LINE_DENSITY_TRACK.trackId,
          locus: 'chr17:83,899,576-84,041,803',
          fracY: 0.5,
        },
      },
    ],
  },
  // The two as one figure. The name is the one the doc and the review log
  // already carry, so what moves is which spec renders it, and a reader cannot
  // reach the claim without the check under it.
  //
  // SIDE BY SIDE, not stacked (review: "this may want to be a side-by-side
  // figure, with an arrow pointing from the first to the second figure, in the
  // relevant region"). Stacked it was 2,000x3,602 -- the three panes' 2,662 plus
  // the density's 940 -- and the second half read as the next step down the
  // page rather than as the check on the first, which is what it is.
  //
  // The arrow the review asks for is the half that is NOT available: parts are
  // separate captures `+append`ed afterwards, so nothing can be drawn across the
  // seam. The pairing is a numbered badge on each half instead (① on both), the
  // substitute ComposeSpec documents, and each half also carries the allele's
  // own `highlight` in the app so the badge lands on something already marked.
  //
  // Horizontal makes HEIGHT the shared dimension rather than width, so the
  // density part is 1,331 to match the panes part rather than the 470 it wanted
  // on its own -- see its `height` for what fills that.
  {
    mode: 'compose',
    name: 'pangenome/hprc_chm13_allele',
    parts: [
      'pangenome/hprc_chm13_allele_panes',
      'pangenome/hprc_chm13_allele_density',
    ],
    direction: 'horizontal',
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
  // hprc_chm13_allele already draws that sequence per element, which is the
  // resolution at which the L1 tiling is visible at all.
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
  // pangenome/hprc_allele_inventory was here and is RETIRED (review: "I am
  // still not sure i like this figure ... the entire allele inventory concept is
  // just tricky to visualize. Might need graph bandage view alongside it. this
  // might be a candidate for figure deletion if we already have that").
  //
  // We already have that, on the same window: hprc_cfhr_deletion draws this
  // exact 200 kb as a graph beside three rows of alignment, and the -84,683 bar
  // that was this figure's subject is the arc that one labels "84.7 kb
  // deletion". So the pairing the note asks for exists, and this was the half of
  // it that had to be read as a lane of grey bars whose rows are a packing
  // rather than a set of haplotypes -- the misreading the spec spent a paragraph
  // heading off.
  //
  // The tutorial section stays, with the BED, the CIGAR trick that draws an
  // insertion at its real magnitude, and the warning that a row is not a
  // haplotype. What it no longer carries is a picture of it.
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
            hg38GeneLane(70),
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
    // against the run's own below-the-fold report, which caught 75px cut at 1090.
    //
    // STAYS 1170, and "reduce height of graph view" was tried three ways before
    // being written down. The graph pane is a fixed 625 css px at this pinned
    // bundle: the page measures 1,165 css px tall at viewportWidth 1000 and at
    // 1400 alike, a `height` on the view entry changes nothing, and a 1010
    // frame reports exactly 155 px cut in both cases -- the same number, which
    // is what says the pane is not responding rather than fitting. A shorter
    // frame crops the drawing; it does not scale it. Nor does a wider one
    // spread it: the force layout is fixed in graph units and auto-fits at
    // 50%, so 1400 px of frame only adds empty canvas to the right.
    viewportHeight: 1170,
    hideTooltip: true,
    // Why this locus and not another deeply traversed bubble: KIV-2 copy number
    // is the reason anyone measures LPA, and nothing in a chain of loops says
    // so. On review the figure read as an arbitrary tangle.
    //
    // Anchored on s110051+, the first node of the GRCh38 walk (12,567 bp at
    // chr6:160,508,381), and dropped below it into the part of the canvas the
    // force layout leaves empty. A graph node rather than a viewport
    // coordinate, so re-running the layout carries the pill with the drawing.
    annotations: [
      {
        type: 'text',
        text: 'KIV-2 copy number varies between people and sets Lp(a), an inherited heart-disease risk factor.',
        fontSize: 22,
        // wrapped rather than hard-broken: a newline is a paragraph break that
        // still wraps at maxWidth on its own, so authored line ends land in the
        // middle of the pill
        maxWidth: 420,
        anchor: { view: 1, graphNode: 's110051+', dx: 20, dy: 320 },
      },
      // WHERE it is, which the pill above never said (review: "the term
      // 'KIV-2' is not visible in the screenshot, may be useful if there was a
      // repeat track or specific location-of-kiv-2 track"). No new track is
      // needed: the array already IS the widest bar in the bubbles lane, the
      // one labelled 33 segments and up to 584 paths, and that bubble's own
      // record is `chr6:160,606,991-160,639,012` — the coordinates this whole
      // figure was picked on. Boxing it names the bar and locates the repeat in
      // one mark, and a repeat track would restate what the graph already says.
      {
        type: 'box',
        anchor: {
          track: 'hprc_minigraph_bubbles',
          locus: 'chr6:160,606,991-160,639,012',
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
          locus: 'chr6:160,606,991-160,639,012',
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
            hg38GeneLane(60),
            hprcSegmentsLane(MHC_CLASSII_REGION),
            {
              trackId: 'hprc2_wave_grch38',
              type: 'LinearMultiSampleVariantDisplay',
              // 340, down from 520 (review: "reduce the height of the
              // multisample variant display also"). 464 haplotype rows do not
              // fit in any height a figure can afford, so the lane is a texture
              // either way and the extra 180 px bought more of the same texture
              // — where the graph pane below it is the half this figure is
              // about, and was the half being squeezed.
              height: 340,
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
    readySelector: `body:has(${GRAPH_DRAWN}):has([data-testid="graph-layout-select"]):has([data-testid="tree_sidebar_dendrogram"]) ${displayPainted('variant-display')}[data-display-phase="ready"]`,
    readyTimeout: 360000,
    settleMs: 5000,
    viewportWidth: 1000,
    // the gene lane, the segments lane, the 464-row callset, and the graph pane
    // under them — the force drawing is about as tall as it is wide where the
    // row stack was flat
    viewportHeight: 1420,
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
    //
    // The band and the ring are joined by an ARROW rather than by a sentence
    // (review: "just draw arrow from highlight to circle, no text annotation or
    // more minimal text annotation on RIGHT side of screen"). Its tail is the
    // bottom of the highlighted span in the callset, so it leaves the band at
    // the band's own x, and its head stops short of the ring by the ring's own
    // radius — an anchored head resolves to the node's CENTRE, which would put
    // the triangle inside the circle.
    //
    // The one remaining label is on the RIGHT: the left half of the graph pane
    // holds the 38.9/19.9 kb arcs, and the previous pill sat on top of them.
    annotations: [
      {
        type: 'circle',
        anchor: { view: 1, graphNode: 's101145+' },
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
        anchor: { view: 1, graphNode: 's101145+', dx: -30, dy: -30 },
        strokeWidth: 3,
      },
      {
        type: 'text',
        // no length in the words: the 12.3 kb allele sits beside this node and
        // labels itself, so "12 kb" in a callout would read as that one
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
]
