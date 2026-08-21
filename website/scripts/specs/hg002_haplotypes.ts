import { displayPainted } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// T2T-HG002 v1.2 ships both haplotypes as contigs of ONE assembly
// (chr1_MATERNAL, chr1_PATERNAL, ...), so comparing them is a self-alignment:
// two panels of the same assembly, framed on the two haplotypes of a
// chromosome. The demo config carries the Q100 project's own maternal-to-
// paternal chain, so nothing here is aligned by us.
//
// WHAT IS ACTUALLY IN THAT CHAIN, measured rather than taken from the README,
// which is written about the GRCh38 pair and not this file (its awk step keys
// on stripping _MATERNAL/_PATERNAL off the TARGET name, which only produces a
// reference-vs-haplotype pairing). Deriving them again costs a genome-wide
// scan of the chain, so they live here whether or not the page cites them:
//
//   zcat hg002v1.2_to_other_haplotype.chain.gz |
//     awk '$1=="chain"{...}'   -> 6,830 chains, 0 cross-chromosome,
//                                 3,415 with a MATERNAL target and 3,415 with
//                                 a PATERNAL one (hence "carries both
//                                 directions", which is what lets one track
//                                 serve both panels)
//     awk 'NF==3{...}'         -> 1,310,500 aligned blocks, largest gap 9,983
//                                 bp on either side, against the README's
//                                 10 kb split threshold. So the biggest indel
//                                 in the file is the cut, not a measurement.
const HG002_CONFIG = 'https://jbrowse.org/demos/hg002/config.json'

// The 8p23.1 inversion, the largest inverted chain in that file by about five
// times (the next is 747 kb on chr7, of 493 inverted chains genome-wide). Read
// off the chain rather than off a paper:
//
//   chr8_MATERNAL:7,822,846-11,688,252  (-)  <-> chr8_PATERNAL:7,774,085-11,631,556
//
// flanked by collinear (+) blocks on both sides. Note the chain's `-` strand
// query coordinates are REVERSE-COMPLEMENT: reading qStart directly puts this
// near 135 Mb, on the wrong arm, which is the easiest way to get this locus
// wrong. The published polymorphism is a 3.8-4.5 Mb segment between the REPD
// and REPP duplication blocks; HG002 is heterozygous for it, which is the only
// reason it is visible in a maternal-vs-paternal comparison at all.
//
// The window is the inversion plus enough flank that the collinear blocks
// either side are in frame. That is the figure's own control: an inversion is
// only legible as one because the sequence around it did not move. Both panels
// take the SAME coordinates here, which is what makes the crossing read as a
// crossing; the collinear pair below deliberately does not.
//
// "Collinear flank" is true at this scale and not below it: a 38 kb inverted
// chain sits at MAT 7,568,742-7,606,984 and a 12 kb one at 12,035,255-12,047,327,
// and both draw as thin off-color threads among the flank ribbons. The page
// says so rather than claiming one off-strand block in frame.
//
// 9 Mb, widened from 5.2 (review: "zoom out a bit more to see context"). The
// inversion is MAT 7,822,846-11,688,252, so this is the event plus ~2.5 Mb of
// collinear flank each side rather than ~0.6, centred on the event's own
// midpoint rather than on a round number. The flank is the control, so more of
// it is more control: at 5.2 Mb the crossing reached the frame edge on the left
// and a reader had to take the "and nothing else moved" on faith.
const INVERSION_RANGE = '5,250,000-14,250,000'
const INVERSION_WINDOW_MAT = `chr8_MATERNAL:${INVERSION_RANGE}`
const INVERSION_WINDOW_PAT = `chr8_PATERNAL:${INVERSION_RANGE}`

// GENES, WHICH THE DEMO CONFIG DOES NOT CARRY (review, on both figures: "if
// possible, show gene tracks too. not sure if available, but would be cool").
// They are available, from the Q100 project's own S3 beside the assembly, and
// they need no rehosting: the JHU Liftoff v0.6 annotation ships one bgzipped
// GFF per haplotype with a `.tbi`, contig names that already match
// (`chr8_MATERNAL`), a `gene_name` attribute, and `Access-Control-Allow-Origin:
// *` on ranged reads. Session tracks rather than config tracks, so nothing has
// to be deployed to jbrowse.org/demos/hg002/config.json for a figure to use
// them.
//
// THEY ARE v1.1 COORDINATES ON A v1.2 ASSEMBLY, which is worth knowing and is
// why the track names say v1.1. There is no v1.2 gene annotation published --
// the annotation directory has v1.2 hetsites, microsatellites and chains and
// no genes. What the version gap costs was measured off the published
// `hg002v1.1_to_hg002v1.2.chain.gz` (47 chains, one per contig, no
// rearrangement in any of them): summing dq-dt along each chain, the largest
// cumulative shift anywhere in the genome is 6,115 bp on chr6_MATERNAL and
// every other contig is under 70 bp. On chr8 it is 1-3 bp across both windows
// here, which is a third of a pixel at the base-level figure and invisible at
// the 9 Mb one. A proper lift would need the GFF re-emitted and hosted; at this
// magnitude that buys nothing these two figures can show.
const GENE_TRACK_BASE =
  'https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/annotation/JHULiftoff/v0.6/hg002v1.1'

function geneTrack(hap: 'MAT' | 'PAT', kind: 'genes' | 'landmarks' = 'genes') {
  const uri = `${GENE_TRACK_BASE}.${hap}.loff.v0.6.gff.gz`
  return {
    type: 'FeatureTrack',
    trackId: `hg002_${kind}_${hap.toLowerCase()}`,
    // the landmark lane's name carries its colour key, so the figure needs no
    // overlay to say what red and blue mean; see STRAND_COLOR
    name:
      kind === 'landmarks'
        ? `Landmark genes (${hap}), forward red / reverse blue`
        : `Genes (JHU Liftoff v0.6, HG002 v1.1 ${hap})`,
    assemblyNames: ['hg002v1.2'],
    adapter: {
      type: 'Gff3TabixAdapter',
      gffGzLocation: { uri, locationType: 'UriLocation' },
      index: {
        location: { uri: `${uri}.tbi`, locationType: 'UriLocation' },
        indexType: 'TBI',
      },
    },
    // LABEL FROM `gene_name`, NOT FROM THE ID. The Liftoff GFF carries no
    // `Name`, so the default `name || id` falls through to the assembly's own
    // ordinal identifier and the lane draws `hg002_chr8_maternal_195` where the
    // gene is ENPP7P1 -- true, and useless as a label. `gene_name` is on every
    // gene record (the README's own ID scheme keeps the HUGO symbol in it).
    //
    // It goes on the TRACK's display config rather than as an inline key on the
    // session spec's `tracks` entry: `labels` is a sub-schema, not a slot, so
    // the `setSlot` pass that folds inline keys onto the display would skip it
    // silently.
    displays: [
      {
        type: 'LinearBasicDisplay',
        displayId: `hg002_${kind}_${hap.toLowerCase()}-LinearBasicDisplay`,
        labels: {
          name: "jexl:get(feature,'gene_name') || get(feature,'name') || get(feature,'id')",
        },
      },
    ],
  }
}

// The panel entry for one haplotype's gene lane. `geneGlyphMode:
// 'longestCoding'` collapses the isoform stack -- the Liftoff annotation
// carries every RefSeq transcript, and this is a context lane, not a
// transcript figure.
function geneLane(hap: 'MAT' | 'PAT', extra: Record<string, unknown> = {}) {
  return {
    trackId: `hg002_genes_${hap.toLowerCase()}`,
    type: 'LinearBasicDisplay',
    geneGlyphMode: 'longestCoding',
    // Same strand colouring as the landmark lane (review: "make the main gene
    // track also color by strand"), so the two lanes on a panel are one
    // vocabulary rather than a coloured lane above an orange one, and the
    // landmark lane's name serves as the key for both.
    //
    // Worth saying what it does NOT do, since the obvious hope for it is wrong:
    // it does not draw the inversion. Every gene here flips strand between the
    // haplotypes, but the density lane is hundreds of genes of both strands, so
    // the two panels read as the same speckle rather than as each other's
    // negative. The eight labelled genes are where that comparison is legible.
    color: STRAND_COLOR,
    ...extra,
  }
}

// NAMED GENES, LABELLED, SO THE FLIP IS READABLE AS TEXT (review: "it is hard
// to see matching genes ... ideally a couple labels would be visible
// particularly in the inverted region so we can see correspondence"). A 9 Mb
// lane of every Liftoff gene cannot carry a label, so this is a second lane over
// the same GFF, filtered to the longest protein-coding genes inside the inverted
// block. It is a separate trackId rather than a second display of the gene track
// because a view cannot hold one track twice.
//
// They are read off the annotation, not chosen: `tabix` the MAT GFF over the
// inverted block (chr8_MATERNAL:7,822,846-11,688,252), keep `gene` records whose
// `gene_biotype` is protein_coding, and rank by span. That gives MSRA 376 kb,
// XKR6 306 kb, TNKS 230 kb, MFHAS1 110 kb, ERI1 98 kb, GATA4 83 kb, PINX1 75 kb,
// BLK 70 kb, and then a long tail. ERI1 and PINX1 used to be missing from a list
// that called itself the longest six -- BLK is eighth by that ranking, not
// sixth -- so the cut is now where the ranking has its own step, at 70 kb.
//
// What they show is the whole claim in a form that needs no ribbon-reading: the
// maternal lane runs MFHAS1, ERI1, TNKS, MSRA, PINX1, XKR6, BLK, GATA4 and the
// paternal one runs the same eight in the opposite order, because the block
// between them is inverted.
const LANDMARK_GENES = [
  'MFHAS1',
  'ERI1',
  'TNKS',
  'MSRA',
  'PINX1',
  'XKR6',
  'BLK',
  'GATA4',
]

const LANDMARK_FILTER = `jexl:${LANDMARK_GENES.map(
  g => `get(feature,'gene_name')=='${g}'`,
).join('||')}`

// STRAND AS COLOUR, NOT AS AN ARROWHEAD (review: "why doesnt gata4, blk have
// strand arrows?"). At 9 Mb across 1400 px a base is 6.4 kb, so GATA4's 83 kb
// and BLK's 70 kb are 13 and 11 px of lane: a glyph that narrow is drawn as one
// solid body with no intron line to hang an arrow off, while MSRA at 59 px has
// room for both. Nothing is wrong with those two genes -- the arrow is simply
// not a channel that survives this zoom for any of them (even MSRA's is a 3 px
// mark), so the lane states strand the way a whole-genome lane can.
//
// It also says more here than an arrow would. Every one of the eight flips
// strand between the haplotypes, checked in the two GFFs rather than inferred
// from the chain -- MSRA is + on MAT and - on PAT, GATA4 + and -, and so on
// through all eight -- so the two lanes come out as each other's colour negative,
// which is the inversion stated a third way, beside the crossing ribbons and the
// reversed name order.
//
// THE BUILT-IN EXPRESSION, verbatim: this is STRAND_COLOR_JEXL
// (plugins/canvas/src/RenderFeatureDataRPC/featureColors.ts), what **Color
// by... -> Strand** writes into the slot, so the figure shows a menu click
// rather than a callback a reader has to copy. An exact match is also what
// makes the track menu's radio read 'strand' instead of 'attribute'; a
// prettier equivalent would silently uncheck it.
//
// It replaced a hand-rolled `strand==1?'#1f77b4':'#d62728'` -- the cookbook's
// blue-forward pair, which is the INVERSE of both the built-in and the synteny
// ribbons' own strand scheme (colorSchemes.strand, posColor '#f00' / negColor
// '#00f'). Blue therefore meant "forward" in the gene lanes and "inverted" in
// the ribbons of the same frame, three inches apart. Now one vocabulary paints
// the whole figure: red forward, blue reverse.
const STRAND_COLOR =
  "jexl:feature.strand==1?'tomato':feature.strand==-1?'cornflowerblue':'goldenrod'"

function landmarkLane(hap: 'MAT' | 'PAT') {
  return {
    trackId: `hg002_landmarks_${hap.toLowerCase()}`,
    type: 'LinearBasicDisplay',
    geneGlyphMode: 'longestCoding',
    jexlFiltersSetting: [LANDMARK_FILTER],
    color: STRAND_COLOR,
    height: 60,
  }
}

// THERE IS NO HET-SITE FIGURE, AND TWO ATTEMPTS AT ONE ARE WHY. It would have
// framed a window inside the COLLINEAR block just left of the inversion, where
// the ribbon is one band (bar a single indel wedge) and the published het-site
// calls underneath it are what separate the haplotypes -- structural agreement
// and sequence identity being different claims.
//
// What the two rounds were worth knowing for, since they are constraints on the
// data rather than on the figure:
//
//   - The 5.2 Mb inversion frame is over the het track's too-many-features
//     gate, so the track renders a warning there rather than data. The window
//     had to be its own capture.
//   - A window ON the breakpoint cannot work at all: the flank maps to
//     chr8_PATERNAL ~7.6 Mb while the inverted side maps to ~11.6 Mb, so no
//     single paternal window contains both and the ribbons come back empty,
//     which is what the first attempt did.
//   - Off the breakpoint, the collinear block beside the inversion is inside
//     8p23.1's defensin/FAM90A duplication, where Liftoff names each
//     haplotype's array copies after different hg38 paralogs -- so the two gene
//     lanes disagreed for a reason that was not the figure's subject.
//
// Neither round changed what it had to show, which is that a dense picket fence
// of ticks is a picture of a statistic (review: "just delete this figure ... it
// just doesnt seem interesting"). hg002_haplotypes_hetsites, its
// COLLINEAR_WINDOW_MAT / _PAT and its HETSITE_TICK all went. The page that
// discussed it has since been cut back to the two figures below.

type PanelTracks = (string | Record<string, unknown>)[]

// A panel with no tracks draws a centered "No tracks active" chip and an OPEN
// TRACK SELECTOR button, which in a two-row frame outweighs the ribbons the
// figure is about. Each panel therefore carries the chain blocks on its OWN
// haplotype's coordinates -- and that is the SAME SyntenyTrack the ribbons come
// from, not a second file. In a plain LGV a SyntenyTrack draws as
// LGVSyntenyDisplay (the only display registered for that pair), whose colorBy
// already promotes to `strand`, so this needs no display config at all.
//
// It resolves per panel because the published chain carries BOTH directions:
// every alignment appears once with the maternal contig as query and once with
// the paternal one, so the maternal panel's fetch returns the mat-as-query
// records and the paternal panel's the pat-as-query records. That is exactly
// the split the mat2pat / pat2mat bigChain pair used to provide, from one file
// instead of two, which is also what stops the blocks and the ribbons from
// disagreeing. Nine records either side across this window, against a het-site
// track that is orders of magnitude over the feature gate here.
//
// The CIGAR layer is left ON, which it could not be when this lane was first
// cut: at megabase scale a whole-genome chain's indels each painted a
// full-opacity marker and buried the strand color they sit on. The renderer's
// `sizeAlpha` now fades an indel whose own on-screen span is sub-pixel, so what
// survives here is the kilobase-scale ones -- the 10 kb split threshold
// measured at the top of this file, rather than noise over it.
const CHAIN_BLOCKS = { trackId: 'hg002v1.2_mat_vs_pat', height: 40 }

function haplotypeSession(
  matLoc: string,
  patLoc: string,
  matTracks: PanelTracks = [],
  patTracks: PanelTracks = matTracks,
) {
  return sessionSpec(HG002_CONFIG, {
    sessionTracks: [
      geneTrack('MAT'),
      geneTrack('PAT'),
      geneTrack('MAT', 'landmarks'),
      geneTrack('PAT', 'landmarks'),
    ],
    views: [
      {
        type: 'LinearSyntenyView',
        // strand is the whole point here: it is what makes the inverted block
        // the one sweep crossing an otherwise same-color frame
        colorBy: 'strand',
        drawCurves: true,
        tracks: [['hg002v1.2_mat_vs_pat']],
        views: [
          { assembly: 'hg002v1.2', loc: matLoc, tracks: matTracks },
          { assembly: 'hg002v1.2', loc: patLoc, tracks: patTracks },
        ],
      },
    ],
  })
}

// THE PANELS DRIFT, WHICH IS THE ONE THING ABOUT THIS VIEW EVERYONE ASKS ABOUT
// (discussion #5610, from the Q100 project). The two rows pan and zoom
// independently, and on a self-alignment that is easy to miss because both
// rulers carry the same numbers -- but the same number is not the same
// sequence: through this collinear block the paternal copy sits 143,362 bp left
// of the maternal one, so typing one locus into both panels frames two places
// that do not correspond.
//
// So the before-frame is the same numbers in both panels, which is what a
// reader does first and is the state the question is about -- not a hand-picked
// offset. Its paternal panel lands in the GAP past this block's end (PAT
// 7,681,207) and before the inversion's (7,774,085), so its chain lane is empty
// and the ribbon leaves the frame: two panels with nothing between them, which
// is the picture of "these coordinates do not correspond".
//
// The maternal window's true counterpart is PAT 7,556,638-7,626,638 (the
// block's own -143,362 offset), give or take the indels the CIGAR walk follows
// -- the after-frame is where the move puts it, not a locstring written here.
const DRIFT_WINDOW_MAT = 'chr8_MATERNAL:7,700,000-7,770,000'
const DRIFT_WINDOW_PAT_BEFORE = 'chr8_PATERNAL:7,700,000-7,770,000'

// THE MARKERS FIGURE MOVED TO THE PERICENTROMERE (reviewer: 'the show location
// markers mostly shines when there are lots of indels interrupting it, so then
// you can see, the matches amongst the indels'). Right, and 8p23.1 could not
// deliver it: that window sits inside one 204 kb chain whose 141 gaps are nearly
// all under 50 bp, so zooming out only made them sub-pixel.
//
// The locus is scored rather than guessed -- ranking every chr8 chain by indels
// at least 2 px wide at this window width puts it at the pericentromeric chain
// chr8_MATERNAL:44,638,867-45,382,648, where 300 kb holds 23 indels of 429 bp or
// more against 0 at 8p23.1.
//
// It was blocked for two review rounds by a DataCloneError the synteny RPC threw
// here at any window width, and the block is gone: that RPC hand-maintained an
// eighteen-buffer transfer list with no dedup, and this locus is the one dense
// enough to put one buffer in it twice. It derives the list now
// (rpcResultWithArrayBuffers), which dedupes by construction.
const MARKER_WINDOW_MAT = 'chr8_MATERNAL:44,880,000-45,180,000'
const MARKER_WINDOW_PAT_BEFORE = 'chr8_PATERNAL:44,880,000-45,180,000'

// Both frames wait on the same synteny-canvas signal and pay the same remote
// fetch (a whole-genome chain read in one go), so the capture settings are
// shared and only the viewport height differs.
const CAPTURE = {
  mode: 'url',
  viewportWidth: 1400,
  readySelector: displayPainted('synteny_canvas'),
  readyTimeout: 120000,
  settleMs: 10000,
} satisfies Partial<ScreenshotSpec>

// One haplotype per axis, in one place. The same two strings are the axes'
// `displayedRegionNames` below, the values the import-form figure types into the
// chromosome boxes, and what the tour types into them -- three copies of a glob
// whose whole job is to match a contig suffix exactly.
const MATERNAL_GLOB = '*_MATERNAL'
const PATERNAL_GLOB = '*_PATERNAL'

// THE WHOLE-GENOME FRAME, which is a dotplot rather than a third linear pair:
// the claim is "nothing moved between chromosomes", and 23 pairs of ribbons is
// not how anyone reads that. Same one-assembly self-alignment as the two frames
// below, so the axis split is the same trick done per axis instead of per panel
// -- the maternal contigs on x, the paternal ones on y.
//
// GLOBS, NOT THE 23 NAMES. `displayedRegionNames` matches through
// selectNamedRegions, so `*_MATERNAL` is the whole haplotype in assembly order
// and survives the assembly being rebuilt; hand-listing them is 46 strings that
// go stale silently. It also picks up exactly the right edge cases -- chrM
// belongs to neither haplotype and matches neither glob, while chrX_MATERNAL
// and chrY_PATERNAL match their own and have no counterpart on the other axis,
// so those two lanes come out EMPTY. That is correct for a male sample and is
// the one part of the frame that looks like a bug.
const WHOLE_GENOME_AXES = [
  { assembly: 'hg002v1.2', displayedRegionNames: [MATERNAL_GLOB] },
  { assembly: 'hg002v1.2', displayedRegionNames: [PATERNAL_GLOB] },
]

// What videos/synteny.ts films.
//
// The tour starts BEFORE the import form rather than on it, so `Add -> Dotplot
// view` is in the clip: `views: []` opens the app on the view launcher, which is
// the state the page's first instruction is given from. The import-form figure
// opens the form directly instead, because a still of a menu is a second figure.
export const hg002VideoFixtures = {
  noViews: sessionSpec(HG002_CONFIG, { views: [] }),
  maternalGlob: MATERNAL_GLOB,
  paternalGlob: PATERNAL_GLOB,
}

export const hg002HaplotypeSpecs: ScreenshotSpec[] = [
  // HOW THE FRAME BELOW IS REACHED BY CLICKING, which is the half of the story
  // a session spec cannot tell. `{type: 'DotplotView'}` with neither axis named
  // is the one route from a spec to the import form (see applyInit), so this
  // opens the form itself rather than a plot.
  //
  // TWO EMPTY AXES, not a bare `{type: 'DotplotView'}`: launchSyntenyView
  // throws outright below two views, so the spec has to name two and leave both
  // unnamed. That is the state applyInit calls "the import form, deliberately".
  //
  // The config carries exactly one assembly, so both dropdowns already read
  // T2T-HG002 v1.2 and there is nothing to pick -- which is the whole reason
  // this dataset needs the chromosome boxes at all. A self-alignment's two axes
  // are the same assembly, and without them both would carry all 47 contigs of
  // both haplotypes interleaved.
  {
    mode: 'url',
    name: 'hg002_haplotypes_import_form',
    url: sessionSpec(HG002_CONFIG, {
      views: [{ type: 'DotplotView', views: [{}, {}] }],
    }),
    // the form is DOM, so there is no canvas to wait on -- the assembly
    // dropdowns are what has to have populated
    readySelector: '[data-testid="import-form"]',
    readyTimeout: 120000,
    settleMs: 3000,
    viewportWidth: 950,
    // Measured back from the run's below-the-fold report every time the form's
    // own height moved: 505 until each axis took its own row and the chromosome
    // boxes gained an opt-in above them, which cost 55 css px.
    viewportHeight: 561,
    stages: [
      {
        actions: [
          // MANUAL FIRST. The config carries a synteny track, so the form opens
          // in Quick start, which offers the track's own pair and a Launch and
          // deliberately shows no chromosome boxes -- a Quick start launch is
          // "this track, as it comes". The boxes are a Manual-mode control, so
          // the click is part of the path a reader has to take, not setup this
          // figure is skipping past.
          { type: 'click', text: 'Manual' },
          // ...and then the boxes themselves are opt-in even in Manual, since
          // the assemblies that want them are the fragmented ones. Both clicks
          // are the path, which is why the frame keeps them rather than arriving
          // at a form already in this state.
          { type: 'click', text: 'Plot only certain chromosomes' },
          {
            type: 'waitForSelector',
            selector: '[data-testid="chromosome-filter-x"]',
          },
          {
            type: 'type',
            selector: '[data-testid="chromosome-filter-x"]',
            value: MATERNAL_GLOB,
          },
          {
            type: 'type',
            selector: '[data-testid="chromosome-filter-y"]',
            value: PATERNAL_GLOB,
          },
          { type: 'delay', ms: 500 },
        ],
        // The two boxes are the only thing on this form that is not the default,
        // so they are what the figure is of. No text callout: the placeholder
        // and the two typed values say it, and a pill would be naming the
        // largest obvious thing in the frame.
        annotations: [
          {
            type: 'box',
            anchor: { selector: '[data-testid="chromosome-filter-x"]' },
            strokeWidth: 3,
          },
          {
            type: 'box',
            anchor: { selector: '[data-testid="chromosome-filter-y"]' },
            strokeWidth: 3,
          },
        ],
      },
    ],
  },
  {
    mode: 'url',
    name: 'hg002_haplotypes_wholegenome',
    url: sessionSpec(HG002_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          // The header is otherwise `hg002v1.2,hg002v1.2`, which on a
          // self-alignment is the same name twice and says nothing about which
          // axis is which -- and which axis is which is the entire frame.
          displayName: 'T2T-HG002 v1.2 maternal (x) vs paternal (y)',
          // The only signal here that is not the diagonal. Every chain runs
          // within a chromosome, so structure alone paints one straight line
          // and the 493 inverted chains are invisible without it; in strand
          // color they are the blue ticks on a red line. Same red-forward /
          // blue-reverse vocabulary as the gene lanes below (STRAND_COLOR).
          colorBy: 'strand',
          // Off (review: "can hide legend"). It floats over the top-right of
          // the plot, which on a square-ish self-dotplot is where the diagonal
          // terminates -- so the one thing it covers is data.
          showColorLegend: false,
          views: WHOLE_GENOME_AXES,
          tracks: ['hg002v1.2_mat_vs_pat'],
        },
      ],
    }),
    // The dotplot paints its own canvas, so this is NOT the synteny_canvas the
    // CAPTURE const above waits on -- hence its own settings rather than a
    // spread. Same remote chain read, so the same generous timeout.
    readySelector: displayPainted('dotplot_webgl_canvas'),
    readyTimeout: 120000,
    settleMs: 15000,
    // Not 1400 like the two frames below: the view's height is fixed
    // (defaultHeight, and a session spec has no way to set it), so width is the
    // only aspect control there is and 1400 gives a plot twice as wide as it is
    // tall. A dotplot's diagonal should read as a diagonal.
    viewportWidth: 950,
    // 767: measured back from the run's own below-the-fold report, which had 63
    // css px of blank under the app frame at 830.
    viewportHeight: 767,
  },
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_8p23_inversion',
    url: haplotypeSession(
      INVERSION_WINDOW_MAT,
      INVERSION_WINDOW_PAT,
      // Genes under the chain blocks on each side. At 9 Mb across 1400 px
      // (~6.4 kb/px) a label is not readable and a whole isoform stack is a
      // mat, so this is the density lane: longest coding isoform, no labels,
      // one row deep enough to pack. What it is here for is the context the
      // review asked for -- the inverted segment is ordinary gene-carrying
      // euchromatin, not a blank block that happened to flip.
      //
      // The landmark lane is the one that carries text, and it goes NEXT TO THE
      // RIBBONS on both sides -- last in the top panel, first in the bottom one,
      // since a panel's array is its top-to-bottom order. That puts the two rows
      // of gene names as close together as this layout allows, which is what
      // makes reading one against the other cheap.
      [
        CHAIN_BLOCKS,
        geneLane('MAT', { showLabels: 'none', height: 60 }),
        landmarkLane('MAT'),
      ],
      [
        landmarkLane('PAT'),
        CHAIN_BLOCKS,
        geneLane('PAT', { showLabels: 'none', height: 60 }),
      ],
    ),
    // 838: the two landmark lanes are +120 over the old 640, and the run's own
    // below-the-fold report asked for the remaining 78
    viewportHeight: 838,
  },
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_follow_panel',
    url: haplotypeSession(
      DRIFT_WINDOW_MAT,
      DRIFT_WINDOW_PAT_BEFORE,
      // THE CHAIN LANE ALONE, no gene lanes (review: "way too much stuff on
      // the screen"), and dropping them fixes a claim as well as the clutter.
      // A round that predates this one added a gene lane per panel on the
      // grounds that the same genes would sit at different offsets before the
      // move and under each other after it. They do not: Liftoff names each
      // haplotype's copies after whichever hg38 paralog it matched, so the
      // after-frame put FAM85B / ENPP7P1 over LOC729732 / ENPP7P3 -- two lanes
      // of different names under a caption saying they correspond, which is
      // the comparison a reader would make and get wrong. (It is the same
      // naming that sank hg002_haplotypes_hetsites, noted above.)
      //
      // What records the move is the chain lane, on both panels. Before: the
      // maternal panel carries the block and the paternal panel's lane is
      // EMPTY, because those coordinates land in the gap past this block's
      // end. After: both lanes carry it and the ribbon closes between them.
      // Empty-to-populated is a difference at a glance, in the one lane the
      // figure is about.
      [CHAIN_BLOCKS],
      [CHAIN_BLOCKS],
    ),
    // 640 until the two gene lanes came out, then measured back to where the
    // app frame ends. The right-click that used to open a context menu into
    // this height is gone; the header toggle needs none.
    viewportHeight: 445,
    // 2x2 rather than a column of four (review). Four 445px frames stacked is
    // most of a page of the same app chrome four times, and the pairs that want
    // comparing are adjacent either way: (1) beside (2) is before and after the
    // toggle, (3) beside (4) the same for the markers. No stage sets its own
    // viewportHeight, so both rows share one and the `+append` has nothing to
    // reconcile.
    stageColumns: 2,
    hideTooltip: true,
    stages: [
      {
        // Nothing to do: this is the state the reader arrives in, and what the
        // toggle is about to change. It used to right-click a chain block for
        // "Move other panel to the matching region", which is the one-shot form
        // of the same thing (reviewer: "we have created a fully new 'follow'
        // toggle button that should be used instead of this manual right click
        // thing"). The menu item is still there and still correct; the toggle
        // is a control in the header rather than two levels down a context
        // menu, and it keeps holding after the first move.
        actions: [{ type: 'delay', ms: 500 }],
        // STAGE TITLES ANCHOR TO THE APP BAR, which is the one element whose
        // rect is the frame's own top-left corner (0,0). A stage title belongs
        // to the picture rather than to any track, so there is no locus for it
        // to hang off -- and a bare `x`/`y` is the thing that goes stale in
        // silence when a viewport width or a lane height moves. Same two
        // numbers, now as offsets into an element that cannot drift.
        //
        // INSIDE the app bar rather than 52 px down it (review, on the figure as
        // a whole: "any other changes you'd suggest?"). At 52 the pill landed on
        // the toolbar row and covered the MATERNAL search box -- and the pair of
        // search boxes is the entire evidence for both frames: frame one says
        // the two panels hold the same numbers, frame two says one of them
        // changed. The app bar's left half is empty in this session, so the
        // title fits there over nothing.
        //
        // TWO LINES, WHICH IS WHAT `maxWidth` BUYS: at the 420 default this
        // title wrapped to three, and the third line reached down into the
        // toolbar row and covered the top of the ring below it. Frames 3 and 4
        // never hit this because their titles are shorter.
        annotations: [
          {
            type: 'text',
            anchor: {
              selector: '[data-testid="app-bar"]',
              alignX: 'left',
              alignY: 'top',
              dx: 24,
              dy: 30,
            },
            maxWidth: 640,
            fontSize: 22,
            // THE STATE THE TOGGLE EXISTS FOR: the two panels have drifted
            // apart, so the paternal lane shows nothing that lines up with the
            // maternal one (review: "it is unclear 'why' we are doing this").
            // Do NOT phrase this as the two rulers sharing coordinates -- a
            // reader reads that as the regions matching, which is exactly the
            // thing that is not true here. The message is only "you are lost,
            // and this button gets you back".
            text: '(1) The panels have drifted apart -- synteny ribbons are not matching here',
          },
          // The control, ringed, in the state it is about to leave. It is a
          // 44px icon among the view's other header icons, so nothing in the
          // frame would otherwise say which one moved the panel below.
          {
            type: 'circle',
            anchor: { selector: '[data-testid="follow-synteny-toggle"]' },
            strokeWidth: 4,
          },
        ],
      },
      {
        actions: [
          {
            type: 'click',
            selector: '[data-testid="follow-synteny-toggle"]',
          },
          // The follow's exact pass is an RPC per level off the anchor's
          // SETTLED window, so this waits on a worker round trip and then on
          // the moved panel refetching at its new window. The canvas is already
          // painted, so there is no new selector to wait on.
          { type: 'delay', ms: 10000 },
        ],
        annotations: [
          {
            type: 'text',
            anchor: {
              selector: '[data-testid="app-bar"]',
              alignX: 'left',
              alignY: 'top',
              dx: 24,
              dy: 30,
            },
            maxWidth: 640,
            fontSize: 22,
            // The recovery, stated as the thing that changed, plus the half
            // that a one-shot move does not have: the panel keeps tracking.
            text: '(2) Follow moves the paternal panel to the matching sequence, and holds it there as you pan',
          },
          {
            type: 'circle',
            anchor: { selector: '[data-testid="follow-synteny-toggle"]' },
            strokeWidth: 4,
          },
        ],
      },
    ],
  },

  // The markers, in ONE frame with the menu that turned them on still open
  // (review: "ideally just show fig 4 with the menu from fig 3 open"). They were
  // frames 3 and 4 of the four-up above -- a menu, then a ribbon -- and a
  // checkbox row keeps CascadingMenu open, so the state right after the click IS
  // both frames at once: the path is on screen, ticked, and what it drew is
  // under it.
  //
  // The menu opens from the view's own "View options" at the top RIGHT and the
  // markers are drawn across the ribbon, so unlike the submenu in the old frame
  // 3 the two do not fight for the same pixels.
  //
  // It FOLLOWS FIRST, and that is not optional: markers pair a point on one
  // panel with the point it maps to on the other, which says nothing while the
  // two panels are still on the drifted windows the session opens at. So this
  // frame is the state the figure above ends in, plus the markers.
  {
    ...CAPTURE,
    name: 'hg002_haplotypes_location_markers',
    url: haplotypeSession(
      MARKER_WINDOW_MAT,
      MARKER_WINDOW_PAT_BEFORE,
      [CHAIN_BLOCKS],
      [CHAIN_BLOCKS],
    ),
    // the same height as the figure above, whose end state this continues from,
    // plus the row the off-screen mate control adds to every synteny menu — the
    // annotation anchors on a row near the bottom of the open menu, and at 445
    // it landed 0.42px past the frame, and the "Show..." submenu it opens needs
    // the room below that row as well
    viewportHeight: 500,
    hideTooltip: true,
    actions: [
      { type: 'click', selector: '[data-testid="follow-synteny-toggle"]' },
      // the follow's exact pass is an RPC per level off the anchor's SETTLED
      // window, so this waits on a worker round trip and then on the moved
      // panel refetching at its new window
      { type: 'delay', ms: 10000 },
      { type: 'click', selector: '[aria-label="View options"]' },
      { type: 'waitForText', text: 'Show...' },
      { type: 'hover', text: 'Show...' },
      { type: 'waitForText', text: 'Show location markers' },
      { type: 'click', text: 'Show location markers' },
      // the markers come back through the synteny RPC rather than from a repaint
      // of what is already on the GPU, so this waits on a refetch
      { type: 'delay', ms: 5000 },
    ],
    annotations: [
      {
        type: 'text',
        anchor: {
          selector: '[data-testid="app-bar"]',
          alignX: 'left',
          alignY: 'top',
          dx: 24,
          dy: 30,
        },
        maxWidth: 640,
        fontSize: 22,
        text: 'Location markers pair a point on one panel with the point it maps to on the other',
      },
      // Both levels are boxed, because the item's own name is not enough to find
      // it -- it is two clicks down from a MoreVert.
      { type: 'circle', anchor: { selector: '[aria-label="View options"]' } },
      { type: 'box', anchor: { text: 'Show...' }, strokeWidth: 3 },
      {
        type: 'box',
        anchor: { text: 'Show location markers' },
        strokeWidth: 3,
      },
    ],
  },
]
