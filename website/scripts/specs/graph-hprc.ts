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
// snapshot the "Launch, then Graph genome view (this region)" menu item
// writes, so the figure documents the launch route rather than a second way in.
// The view cuts its subgraph from the track's own tabix indexes on attach.
const HPRC_CONFIG = local('test_data/graphgenomeview/hprc.json')
const SEGMENTS_TRACK = 'hprc_minigraph_segments'
// its `name` in every fixture, which is the label a launch submenu lists it by
const SEGMENTS_TRACK_NAME = 'HPRC release 2 graph (rGFA segments)'
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
const CFHR_DELETED = { refName: 'chr1', start: 196759450, end: 196844134 }
const CFHR_DELETED_LOCUS = `chr1:${CFHR_DELETED.start + 1}-${CFHR_DELETED.end}`

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
// GRCh38 endpoint: 141,710 bp of CHM13 chr17 hanging off a GRCh38 anchor,
// one link in and one link out. Subtelomeric, which is where T2T has sequence and
// GRCh38 has none.
const CHM13_WINDOW = 'chr17:83,010,000-83,040,000'
const CHM13_REGION = {
  refName: 'chr17',
  assemblyName: 'hg38',
  start: 83010000,
  end: 83040000,
}
const CHM13_NODE = 's460574'
// The bubble the node is the long allele of: 28 segments over a 928 bp
// reference span, longest allele 145,411 bp (`tabix bubbles.bed.gz
// 'GRCh38#0#chr17:83,022,000-83,024,000'`; release 2.0 had it as 34 segments
// over 1,023 bp with a 146,023 bp allele).
const CHM13_BUBBLE = { refName: 'chr17', start: 83022324, end: 83023252 }
// The node's own span on CHM13, from its `SN`/`SO` tags.
const CHM13_ALLELE = { refName: 'chr17', start: 83899717, end: 84041427 }
// The node's own span padded to a round window, and it STAYS this tight
// (review: "ideally we would zoom out the lineargenomeview even more to show
// how these L1 transposons are more frequent here than elsewhere"). Widening it
// draws nothing, and that is a fact about the SEQUENCE rather than about the
// lane: the flank is the same material as the allele. Counted off
// chm13v2.0_rmsk.bb over matched 142 kb windows, the allele carries 44 L1
// records at 24.0% bp-weighted divergence and the left flank 41 at 23.9%, both
// 95% L1M*. There is no boundary for a wider window to put in frame.
//
// (Two earlier passes each concluded something wider WAS there -- first "no
// local contrast", then a 5.3 Mb density lane in which the allele was the
// tallest bin. The first was the joined-span bug in build_repeat_density.sh,
// every number in it roughly double. The second was real but window-dependent:
// binned to 100 kb, 130 of chr17's 843 bins carry more LINE than this allele,
// so the lane was measuring the box it was drawn in.)
const CHM13_ALLELE_WINDOW = 'chr17:83,880,000-84,060,000'

// C4, from the tutorial's own table of loci worth a look.
// `tabix hprc-v2.1-mc-grch38.links.bed.gz 'GRCh38#0#chr6:31980000-32050000'`
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

// A repeat lane read for WHAT THE SEQUENCE IS MADE OF, never for how much of it
// there is (review: "the repeatmasker track is not very interesting
// unfortunately and looks sort of glitchy even, just being collapsed layout.
// its also too zoomed in to tell if this amount of repeat is significant
// compared to background"). The second half of that is right and unfixable, and
// three rounds were spent trying to fix it anyway -- a wider element window, a
// 3 Mb density lane, a 5.3 Mb one -- before the annotation itself said why.
//
// THE L1 HERE IS DEAD, and the composition rules out the reading a density lane
// kept being built to support (review: "i just wanted to show that it seems like
// the loop in the graph is an 'l1 invasion' or cluster"). Over the allele's
// 142 kb, chm13v2.0_rmsk.bb carries 44 L1 records at 24.0% bp-weighted
// divergence, 95% of them L1M* -- the mammalian-wide subfamilies, not primate
// ones. There is no L1HS and nothing under 6% divergence. An invasion is L1PA2
// through L1HS under 5%, so whatever built this interval finished before the
// primates. The left flank is 41 records at 23.9%, also 95% L1M*: the same
// material, which is why nothing separates the two at any window.
//
// What the lane CAN say is per-element and true: this interval is built out of
// old L1 fossils, which is the sequence a BAC-and-Sanger reference had no way to
// place, and that is the mechanism the lane was added for. Labels stay off: 171
// repeat names over 180 kb is a wall of small print, and the class is the one
// thing the colour already carries.
//
// (`bigRmskBed` JOINS the fragments of one insertion across intervening
// sequence, so a record's span is not an element length -- an earlier version of
// this comment read a 13.6 kb span off it and called it an L1MD element. Aligned
// bases top out near 7.9 kb, and joined records overlap enough that summing them
// passes 100% of the window. Coverage comes from the merged bigWig instead.)
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

// The one node both halves circle, so the pair states its own correspondence
// instead of asserting it in a caption (review: "IDEALLY this would even
// circle things in the backbone view that match the force directed bandage
// view"). Through release 2.0 this was the 12 kb reference node the allele
// attaches across, the green one under the reference-position ramp, chosen
// because it was also the interval `Highlight in hg38` writes; release 2.1
// cuts that stretch into eleven segments, none of them a landmark, so the ring
// moved onto the allele itself: the node the menu is open on, black because
// it has no reference position, sitting under the band the menu left in the
// linear view. The caption says which is which. ONE ring, not two (review:
// "why are there three circles?"): the pair used to ring the allele's
// reference node and the longest allele over it, drawn touching on the force
// half, and the reader counted circles rather than reading them.
const MHC_LANDMARK_NODES = [HPRC_ALLELE]

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
          // and hprc_lpa_kiv2 carries the bubbles lane on a window where its
          // labels fit.
          tracks: [hg38GeneLane(70), hprcSegmentsLane(MHC_REGION)],
        },
        {
          type: 'GraphGenomeView',
          showDeletionEdges: true,
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
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.1-mc-grch38",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  },
  "displayDefaults": { "showLabels": "none" }
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
// pangenome/hprc_mhc_anchored opens its menu on: the 1.8 kb NA20809.2 allele
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

// The bubble tier and the curve it was built from, shared by the
// whole-chromosome figure and the chromosome tour.
//
// The tier is one node per BUBBLE (scripts/build_bubble_tier.sh over the
// `gfatools bubble` decomposition, hosted as hprc-v2.1-mc-grch38.tier10000.*),
// which is what makes a whole chromosome drawable at all: 474 nodes for chr1
// against ~751k segments in the graph.
const HPRC_TIER_SESSION_TRACK = {
  type: 'FeatureTrack',
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
// A haplotype loaded as an assembly, which turns the node menu's `Open in`
// from the reference's flanking interval into the donor's own coordinates
// ---------------------------------------------------------------------------
//
// NA20809 haplotype 2 is the donor minigraph credits HPRC_ALLELE to (the
// class II bubble's off-reference sequence is mostly HG01071 haplotype 1's, 64
// of its 254 segments and 121 kb, but this allele is not among them). UCSC's
// GenArk hub for that assembly (GCA_044166615.1) names its sequences by
// GenBank accession, which is how the graph names them too
// (`NA20809#2#CM094351.1` in the graph is `CM094351.1` in the 2bit), and its
// chromAlias file spells the graph's PanSN name in an `hprcV2` column. The
// assembly loads as `NA20809.2` with the graph's `NA20809#2` among its
// aliases, and the launch resolves the node's haplotype against that alias.
// The fixture is test_data/graphgenomeview/hprc_haplotype.json.
//
// The segments track there lists the haplotype among its `assemblyNames`, so
// the pane the launch opens carries the graph's own segments on the
// haplotype's coordinates as well as GenArk's RefSeq-mRNA lane.
const HPRC_HAPLOTYPE_CONFIG = local(
  'test_data/graphgenomeview/hprc_haplotype.json',
)
const HAPLOTYPE = 'NA20809.2'
// HPRC_ALLELE's own span on the haplotype, which the launched pane is titled by
const HAPLOTYPE_ALLELE_LOCUS = 'CM094351.1:32,495,297-32,497,076'
// `<trackId>-<displayType>`, the id a track shown with no explicit displayId
// gets (packages/core/src/util/tracks.ts); the launched pane shows its lanes
// that way. The lane is HPRC's CAT annotation of this haplotype, sliced to the
// MHC (test_data/graphgenomeview/hprc_mhc_NA20809.2.genes.gff3.gz): GenArk's
// own gene lanes are empty here, RefSeq mRNAs mapping nothing within 100 kb of
// the allele. CAT puts HLA-DRB9 and HLA-DRB6 either side of it and no HLA-DRB5
// anywhere on this haplotype.
const HAPLOTYPE_GENES_DISPLAY = 'NA20809.2_cat_genes-LinearBasicDisplay'
const HAPLOTYPE_GENES_READY = `[data-display-id="${HAPLOTYPE_GENES_DISPLAY}"][data-display-phase="ready"]`
const HAPLOTYPE_LGV = 'hprc_haplotype_lgv'
const HAPLOTYPE_GRAPH = 'hprc_haplotype_graph'
// The pane the launch adds is the one view the session did not pin an id for.
// The launch frames it on the allele alone, 1.8 kb, which shows the segment
// and nothing around it; a few zoom-outs on that pane's own button bring the
// haplotype's neighbouring mRNAs and the graph's other segments into frame.
const LAUNCHED_VIEW = `[data-testid^="view-container-"]:not([data-testid="view-container-${HAPLOTYPE_LGV}"]):not([data-testid="view-container-${HAPLOTYPE_GRAPH}"])`
const LAUNCHED_ZOOM_OUT = `${LAUNCHED_VIEW} [data-testid="zoom_out"]`
const launchedZoomOut = (clicks: number): ScreenshotAction[] =>
  Array.from({ length: clicks }, () => [
    { type: 'click' as const, selector: LAUNCHED_ZOOM_OUT },
    { type: 'waitForAppSettled' as const, timeout: 120000 },
  ]).flat()

// The MHC class II cut with the haplotype loaded and nothing opened yet. The
// tour takes the node's menu from here; the figure takes it too and captures
// what it adds.
//
// No `connectedViewId` on any of these graph panes, and the recipe worklist is
// why: it is a session-spec field the figure-recipe dialog cannot map to a
// click, so carrying it would grow spec-recipe-unmapped.txt. It is also not
// needed — with one linear view on the assembly in the session, the plugin
// pairs hover sync and `Open in` with that view (linearViewTarget's fallback).
export function hprcHaplotypeSession(paneHeight?: number) {
  return sessionSpec(HPRC_HAPLOTYPE_CONFIG, {
    views: [
      {
        id: HAPLOTYPE_LGV,
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: TOUR_MHC_LOCUS,
        tracks: [hg38GeneLane(70), hprcSegmentsLane(MHC_REGION)],
      },
      {
        id: HAPLOTYPE_GRAPH,
        type: 'GraphGenomeView',
        loadedTrackId: SEGMENTS_TRACK,
        loadedRegion: MHC_REGION,
        layoutMode: 'force',
        colorScheme: 'reference-position',
        ...(paneHeight === undefined ? {} : { paneHeight }),
      },
    ],
  })
}

// ---------------------------------------------------------------------------
// The bubble tier over the MHC, the coarse end of the ladder the tier tour
// climbs down
// ---------------------------------------------------------------------------
//
// Two megabases rather than the whole chromosome the figure draws. On the
// whole-chromosome tier a bubble is narrower than a pixel and the drawing
// gives it a floor, and a graph-node anchor there landed on a neighbour: the
// tour's right-click on s101110 opened s100702, 2.6 Mb away, which at 90 kb per
// pixel is 29 px. At 1 kb per pixel the class II bubble is sixty pixels wide
// and its menu is its own. The chromosome-scale picture stays with
// pangenome/hprc_whole_chromosome, which clicks nothing.
const MHC_TIER_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 31_500_000,
  end: 33_500_000,
}
const MHC_TIER_WINDOW = 'chr6:31,500,001-33,500,000'
const MHC_TIER_LGV = 'hprc_mhc_tier_lgv'
const MHC_TIER_GRAPH = 'hprc_mhc_tier_graph'
// The MHC class II bubble in the tier, chr6:32,486,309-32,575,299
// (`tabix …tier10000.segs.bed.gz 'GRCh38#0#chr6:32,400,000-32,600,000'`):
// 254 segments and a 205 kb longest allele (release 2.0 had 91 and 78 kb over
// chr6:32,486,309-32,550,924), and the window every MHC figure on the page is
// cut inside.
const MHC_TIER_BUBBLE = 's329829'

// No fine segments lane in the view. Over 2 Mb it is not gated, it draws, and
// a thousand segments packed into rows under `heightMode: 'grow'` took the
// graph pane off the bottom of a 1300 px frame; the fine cut the tour ends on
// needs the track in the SESSION, which the config supplies, not in the view.
export function hprcTierSession() {
  return sessionSpec(HPRC_CONFIG, {
    sessionTracks: [HPRC_TIER_SESSION_TRACK, HPRC_BUBBLE_SCORE_SESSION_TRACK],
    views: [
      {
        id: MHC_TIER_LGV,
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: MHC_TIER_WINDOW,
        tracks: [
          cytobandLane(),
          hg38GeneLane(60),
          {
            trackId: 'hprc_bubble_score',
            type: 'LinearWiggleDisplay',
            height: 90,
          },
          {
            trackId: 'hprc_tier',
            type: 'LinearBasicDisplay',
            showLabels: 'none',
            color: referencePositionColor(MHC_TIER_REGION),
            height: 50,
          },
        ],
      },
      {
        id: MHC_TIER_GRAPH,
        type: 'GraphGenomeView',
        loadedTrackId: 'hprc_tier',
        loadedRegion: MHC_TIER_REGION,
        layoutMode: 'auto',
        colorScheme: 'reference-position',
      },
    ],
  })
}

// ---------------------------------------------------------------------------
// The synteny launch out of the graph, which needs two loaded contributors AND
// a synteny track aligning them
// ---------------------------------------------------------------------------
//
// What website/scripts/videos/pangenome.ts films on the human graph beyond the
// end-to-end tour: the two sessions above and the ids their steps click.
export const hprcVideoFixtures = {
  haplotype: HAPLOTYPE,
  haplotypeNode: HPRC_ALLELE,
  haplotypeGenesDisplay: HAPLOTYPE_GENES_DISPLAY,
  haplotypeSession: hprcHaplotypeSession,
  launchedZoomOut,
  tierSession: hprcTierSession,
  tierGraphViewId: MHC_TIER_GRAPH,
  mhcBubbleNode: MHC_TIER_BUBBLE,
  segmentsTrackName: SEGMENTS_TRACK_NAME,
  // inside the bubble the tour lands on, and holding HPRC_ALLELE
  mhcSelection: { start: 'chr6:32,500,000', end: 'chr6:32,545,000' },
}

const ABCA7_CONFIG = encodeURIComponent(
  'https://jbrowse.org/demos/hprc/config.json',
)
const ABCA7_REPEAT_KEY = 'chr19:1049406-1050096'

// The adotto catalogue's row for the VNTR (adotto_repeats.hg38.bed.gz,
// chr19:1049407-1050096), the record TRGT genotyped. A FromConfigAdapter is
// not among the adapters the walk rows read repeats from, so the Repeat
// dropdown still offers only the TRGT record.
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

function abca7LinearView() {
  return {
    type: 'LinearGenomeView',
    assembly: 'hg38',
    loc: 'chr19:1,049,000-1,050,500',
    tracks: [
      {
        trackId: 'hg38_ncbiRefSeq_ucsc',
        type: 'LinearBasicDisplay',
        showOnlyGenes: true,
        displayMode: 'compact',
        height: 40,
      },
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
    ],
  }
}

function abca7GraphView() {
  return {
    type: 'GraphGenomeView',
    loadedTrackId: 'hprc_v2_1_gbz_lanes',
    loadedRegion: {
      refName: 'chr19',
      assemblyName: 'hg38',
      start: 1049407,
      end: 1050096,
    },
    layoutMode: 'walkrows',
    colorScheme: 'uniform',
    repeatTrackId: 'hprc_abca7_trgt',
    repeatKey: ABCA7_REPEAT_KEY,
    paneHeight: 600,
  }
}

function abca7Views() {
  return [abca7LinearView(), abca7GraphView()]
}

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
  // is unchanged: `Highlight in hg38` on a 1.8 kb NA20809.2 allele writes the
  // 12 kb of GRCh38 backbone it attaches across, which is HLA-DRB5,
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
  // The C4 cut with its parts named, above the page's end-to-end clip. Both
  // anchors come from `node scripts/probe-graph-nodes.ts
  // pangenome/hprc_graph_anatomy`: s352179+ is NA18948's 21 kb allele, the
  // largest off-reference node in the cut.
  {
    mode: 'url',
    name: 'pangenome/hprc_graph_anatomy',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: C4_WINDOW,
          tracks: [hg38GeneLane(70), hprcSegmentsLane(C4_REGION)],
        },
        {
          type: 'GraphGenomeView',
          showDeletionEdges: true,
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: C4_REGION,
          layoutMode: 'force',
          colorScheme: 'reference-position',
          // Halos and route chips are introduced on the KIV-2 figure further
          // down; here they arrived unexplained, and one chip sat over the
          // C4A junction the backbone label points past.
          showBubbles: false,
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
        anchor: { view: 1, graphNode: 's329770+' },
        dx: 110,
        dy: 50,
      },
      // s352179+ is NA18948's 21 kb allele, the largest off-reference node in
      // the cut. It runs to the lower left, so the pill hangs off it to the left
      // and the leader comes in across the node.
      {
        type: 'text',
        text: 'allele',
        leader: true,
        fontSize: 20,
        anchor: { view: 1, graphNode: 's352179+' },
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
        anchor: { view: 1, graphNode: 's329764+' },
        dx: -130,
        dy: 145,
      },
    ],
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    viewportWidth: 1000,
    viewportHeight: 1040,
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
  // link-mark track and drop the graph panel. Decided against, with
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
          showDeletionEdges: true,
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
    // the synteny canvas, not TOOLBAR_READY: this is the one HPRC figure with no
    // graph pane, so the plugin's toolbar never appears
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
  // never closed. What the lane shows is the mechanism: the inserted 142 kb is
  // built out of ancient L1, which is the sequence a BAC-and-Sanger reference had
  // no way to place.
  //
  // ONE lane, where there were two, and the claim is COMPOSITION rather than
  // amount: see repeatLane for the divergence and subfamily counts that decided
  // both, and for the density part that used to sit beside this one.
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
    name: 'pangenome/hprc_chm13_allele',
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
    // the graph's own fetch is ~7 s here and the node box is anchored through the
    // view's nodePositions, so a shorter settle can capture before there are any
    // the force layout's "Computing layout" overlay can go up after readiness
    actions: [
      {
        type: 'waitForSelector',
        selector: '[data-testid="loading-overlay"]',
        hidden: true,
        timeout: 180000,
      },
    ],
    viewportWidth: 1000,
    // 1112, off the run's own reports, after three height cuts asked for by the
    // same review note: the graph pane 420 -> 320, the repeat lane to one
    // collapsed row, and the bubble lane to the one row its filter leaves. It
    // was 1078, which the CLIPPED BELOW THE FOLD report then put 33 px over.
    viewportHeight: 1222,
    hideTooltip: true,
    annotations: [
      {
        type: 'box',
        anchor: { view: 1, graphNode: CHM13_NODE },
        strokeWidth: 3,
      },
      // The badge that sat on the arc is GONE with the rest of the ① pairing
      // (review: "presumably the loop should also be labeled with '1'"). It
      // numbered this node against the bar below it and a shaded column in a
      // part that no longer exists; with two panes to pair rather than three,
      // the box is the landmark and a number on it counts to one.
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
      // coordinate off the ramp entirely (graph_genome_view.md, "Color schemes
      // and matching a linear track"). So the boxed arc is grey for
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
      // HS1_RMSK_TRACK). It used to carry which assembly, what red means, and a
      // percentage against the flanks; the percentage is a measurement a reader
      // cannot check against the picture, and the rest is a label, which belongs
      // on the track.
      //
      // This was ① of a numbered pair and the density part it paired with is
      // gone, so NOTHING replaces it (review: "i just wanted to show that it
      // seems like the loop in the graph is an 'l1 invasion' or cluster"). A
      // label naming the allele here would be naming the largest thing in the
      // frame: the bottom pane is 180 kb and the allele is 142 kb of it, so the
      // bar runs nearly the pane's width. The pane's own displayName pairs with
      // the top one's, and the app draws the allele's `highlight` under it.
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
            hprcSegmentsLane(LPA_REGION),
          ],
        },
        {
          type: 'GraphGenomeView',
          showDeletionEdges: true,
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
    viewportWidth: 1000,
    // Sized off the run's blank-below-content report. The graph pane is a fixed
    // height, so a shorter frame crops the drawing rather than scaling it.
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
        anchor: { view: 1, graphNode: 's343607+' },
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
  // The marked deletion survives that filter but is MULTI-ALLELIC -- nine
  // deletion ALTs, four of them the 1.8 kb allele (10,246 bp gone) and five
  // within 11 bp of REF -- so the colored block under the band is the site's
  // carriers, not the 10.2 kb allele's alone. The caption says "a deletion
  // there" for that reason.
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
  // So the figure marks one EVENT instead: `highlight` puts a band on the
  // 12,014 bp record at chr6:32,517,422, which crosses the gene lane, the
  // segments lane and the genotype matrix in one column — 46 of 437
  // haplotypes carry its 10.2 kb deletion. The graph below is the force drawing (review:
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
              jexlFilters: MHC_CALLSET_FILTER,
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
    viewportWidth: 1000,
    // the gene lane, the segments lane, the 464-row callset, and the graph pane
    // under them — the force drawing is about as tall as it is wide where the
    // row stack was flat
    viewportHeight: 1480,
    hideTooltip: true,
    // The event in the graph as well as in the tracks (review: "i see there is a
    // highlight on the lineargenomeview but no highlight in the graph itself").
    // The view's `highlight` is a band on a coordinate axis and the force
    // drawing has none, so the graph side is a ring on the node instead.
    //
    // The ring is on HPRC_ALLELE, the 1.8 kb node that IS the deletion in the
    // graph: the walk that takes it skips the 12 kb of backbone under the band
    // (s329875+ to s329885+ in release 2.1, eleven segments from 32,517,416 to
    // 32,529,437 against the band's 32,529,438). Through release 2.0 the ring
    // sat on the one 12 kb reference node that stretch was, s101145+; 2.1 has
    // no single node there worth ringing, the longest being 4.3 kb.
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
        anchor: { view: 1, graphNode: HPRC_ALLELE },
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
        anchor: { view: 1, graphNode: HPRC_ALLELE, dx: -30, dy: -30 },
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
  // OUT OF THE GRAPH AND INTO THE HAPLOTYPE, at human scale. The E. coli page
  // has pangenome/pggb_strain_launch for this move and this page had only
  // CHM13 (hprc_chm13_allele), on the belief that the other 460 haplotypes
  // could not be loaded — see hprcHaplotypeSession for why they can. The node
  // is the 1.8 kb NA20809.2 allele over HLA-DRB5 that the layout pair and the
  // end-to-end tour already open a menu on; here the menu's `Open in
  // NA20809.2` entry is taken, and what the frame adds is the pane that opens:
  // the haplotype's own chr6 (CM094351.1) at the segment's own offset, with
  // the GenArk RefSeq-mRNA lane and the segments track on those coordinates.
  //
  // The menu is driven rather than the end state declared, so the pane is the
  // one the launch makes, not an imitation of it.
  {
    mode: 'url',
    name: 'pangenome/hprc_haplotype_launch',
    // 420: the same trade the CHM13 figure and the force half of the layout
    // pair make, since the pane is read for one ringed node beside the chain
    // it hangs off and the launched pane below needs the height more.
    url: hprcHaplotypeSession(420),
    readySelector: TOOLBAR_READY,
    readyTimeout: 180000,
    viewportWidth: 1100,
    // off the run's own below-the-fold report at 1150: the launched pane
    // arrives at its lanes' default heights, which no session pins
    viewportHeight: 1250,
    hideTooltip: true,
    // Two frames, on review: the node's menu with the entry taken, then the pane
    // it opens with the node's own segment boxed and joined to the ring.
    stages: [
      {
        viewportHeight: 820,
        actions: [
          // the auto-fit has to have finished before the anchor means anything
          { type: 'delay', ms: 2000 },
          { type: 'rightclick', anchor: { view: 1, graphNode: HPRC_ALLELE } },
          { type: 'waitForText', text: `Open in ${HAPLOTYPE}` },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { view: 1, graphNode: HPRC_ALLELE },
            radius: 20,
            strokeWidth: 3,
          },
          { type: 'box', anchor: { text: `Open in ${HAPLOTYPE}` } },
        ],
      },
      {
        // reloaded at full height: the launched pane's lanes do not load
        // below the first frame's fold
        url: hprcHaplotypeSession(420),
        viewportHeight: 1170,
        actions: [
          { type: 'delay', ms: 2000 },
          { type: 'rightclick', anchor: { view: 1, graphNode: HPRC_ALLELE } },
          { type: 'waitForText', text: `Open in ${HAPLOTYPE}` },
          { type: 'click', text: `Open in ${HAPLOTYPE}` },
          // the launched pane's own gene lane, fetched off hgdownload
          {
            type: 'waitForSelector',
            selector: HAPLOTYPE_GENES_READY,
            timeout: 180000,
          },
          // 1.8 kb to ~28 kb, so the allele sits among the haplotype's own genes
          ...launchedZoomOut(6),
          { type: 'delay', ms: 3000 },
        ],
        annotations: [
          {
            type: 'circle',
            anchor: { view: 1, graphNode: HPRC_ALLELE },
            radius: 20,
            strokeWidth: 3,
          },
          {
            type: 'box',
            anchor: {
              view: 2,
              track: SEGMENTS_TRACK,
              locus: HAPLOTYPE_ALLELE_LOCUS,
            },
            pad: 4,
          },
          {
            type: 'arrow',
            fromAnchor: { view: 1, graphNode: HPRC_ALLELE, dy: 22 },
            anchor: {
              view: 2,
              track: SEGMENTS_TRACK,
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
  {
    mode: 'url',
    name: 'pangenome/hprc_abca7_repeat_units',
    url: sessionSpec(ABCA7_CONFIG, {
      sessionTracks: [ABCA7_VNTR_TRACK],
      views: abca7Views(),
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 240000,
    viewportWidth: 1400,
    viewportHeight: 1095,
    hideTooltip: true,
    actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
    annotations: [
      {
        type: 'box',
        anchor: { selector: '[data-testid="graph-repeat-select"]' },
      },
    ],
  },
  {
    mode: 'url',
    name: 'pangenome/hprc_abca7_disagreements',
    url: sessionSpec(ABCA7_CONFIG, {
      sessionTracks: [ABCA7_VNTR_TRACK],
      views: [
        {
          ...abca7LinearView(),
          tracks: abca7LinearView().tracks.slice(1),
        },
        {
          ...abca7GraphView(),
          // three samples whose calls land on both walks, two where reads and
          // assemblies part, and two carrying a walk the view leaves unscored:
          // HG02559's second allele has no spanning read, HG04199's second walk
          // does not span the array
          walkRowSamples: [
            'HG00099',
            'HG03688',
            'HG00741',
            'HG02647',
            'HG01943',
            'HG02559',
            'HG04199',
          ],
          paneHeight: 360,
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 240000,
    viewportWidth: 1400,
    viewportHeight: 775,
    hideTooltip: true,
    actions: [{ type: 'waitForAppSettled', timeout: 180000 }],
  },

  // What `pangenome_prepare_graph` builds, drawn. That page runs five build
  // stages and carried no figure at all, so a reader finished the conversion
  // with nothing to check their own output against.
  //
  // The two BED indexes as an ordinary FeatureTrack lane, colored by `rank`
  // with the page's own `addtrack` fence's jexl rather than by reference
  // position: rank is what an rGFA's `SR` tag carries and what the projection
  // is judged on, so the picture answers "did the conversion keep the
  // backbone?". Blue is the rank-0 backbone and orange everything the
  // haplotypes add, which is the negative the frame needs.
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
              heightMode: 'grow',
              color:
                "jexl:feature.rank==0 ? 'rgb(52,152,219)' : 'rgb(237,137,44)'",
            },
          ],
        },
      ],
    }),
    // The C4 genes in the lane above, so the gate is content rather than the
    // track name the header prints before anything draws.
    readyText: 'C4A',
    readyTimeout: 180000,
    viewportHeight: 700,
  },
]
