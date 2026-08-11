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
// reference-vs-haplotype pairing). The tutorial's "what this alignment cannot
// show" rests on these, so they are worth not re-deriving:
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
  "jexl:get(feature,'strand')==1?'tomato':get(feature,'strand')==-1?'cornflowerblue':'goldenrod'"

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

// The base-level half of the comparison, and the figure that keeps the one
// above honest: a window inside the COLLINEAR block just left of the inversion,
// where the ribbon is one band (bar a single indel wedge) and the het sites
// underneath it are what separate the haplotypes. Structural agreement and
// sequence identity are different claims, and this is the frame that shows the
// second one failing where the first one holds.
//
// It has to be its own figure for two reasons. The 5.2 Mb inversion frame is
// over the het track's too-many-features gate, so the track renders a warning
// there rather than data. And a window ON the breakpoint cannot work at all:
// the flank maps to chr8_PATERNAL ~7.6 Mb while the inverted side maps to
// ~11.6 Mb, so no single paternal window contains both and the ribbons come
// back empty -- which is what the first attempt at this figure did.
//
// hg002_haplotypes_hetsites was here and is DELETED (review: "just delete this
// figure ... it just doesnt seem interesting"). It framed a collinear block with
// each haplotype's genes over the published het-site calls, to say that
// structural agreement is not sequence identity. Two rounds went into making it
// readable -- off the 8p23.1 defensin/FAM90A duplication, where Liftoff names
// each haplotype's array copies after different hg38 paralogs and the two gene
// lanes disagreed for a reason that was not the figure's subject; then wider,
// with the het track force-loaded past its feature gate. Neither round changed
// what it had to show, which is that a dense picket fence of ticks is a picture
// of a statistic. The prose keeps the claim; the het-site track config stays in
// the tutorial as something to turn on.
//
// COLLINEAR_WINDOW_MAT / _PAT and HETSITE_TICK went with it.

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
// survives here is the kilobase-scale ones -- which is the "chains are split at
// large gaps" the page discusses, rather than noise over it.
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

export const hg002HaplotypeSpecs: ScreenshotSpec[] = [
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
      // GENES ARE WHAT MAKES THE MOVE VISIBLE, and the frame is unreadable
      // without them. One alignment covers this whole window, so its ribbon
      // fills the band edge to edge with both its corners off-screen: it is the
      // same flat block of colour before and after, and the only thing on the
      // first cut of this figure that recorded the move was the locstring in
      // the search box. With a gene lane under each ruler the same genes sit at
      // different offsets in frame one and under each other in frame two, which
      // is the whole claim.
      [CHAIN_BLOCKS, geneLane('MAT', { displayMode: 'compact', height: 60 })],
      [CHAIN_BLOCKS, geneLane('PAT', { displayMode: 'compact', height: 60 })],
    ),
    // The context menu opens below the chain lane, near the top of the maternal
    // panel, so it hangs over the band rather than off the frame.
    viewportHeight: 640,
    hideTooltip: true,
    stages: [
      {
        actions: [
          // Mid-window, on the chain lane's block row (fracY 0 is the top of the
          // display and the blocks are its first ~10px). The maternal panel is
          // views[0].views[0]: a path, because both panels carry the same
          // trackId and naming the track alone would resolve in whichever one
          // the walk reached first.
          {
            type: 'rightclick',
            anchor: {
              view: [0, 0],
              track: 'hg002v1.2_mat_vs_pat',
              locus: 'chr8_MATERNAL:7,735,000',
              fracY: 0,
              dy: 6,
            },
          },
          // The item waits on the feature fetch (the mate's assembly is what
          // decides whether any panel can be moved), so gate on the item itself
          // rather than on the menu opening.
          {
            type: 'waitForText',
            text: 'Move other panel to the matching region',
          },
          { type: 'hover', text: 'Move other panel to the matching region' },
          { type: 'delay', ms: 500 },
        ],
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
            fontSize: 22,
            text: '(1) Same coordinates, different sequence',
          },
          {
            type: 'box',
            anchor: { text: 'Move other panel to the matching region' },
            strokeWidth: 3,
          },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Move other panel to the matching region' },
          // the paternal panel re-navigates and the level refetches at its new
          // window; the canvas is already painted, so there is no new selector
          // to wait on
          { type: 'delay', ms: 8000 },
        ],
        closeMenusAfter: true,
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
            fontSize: 22,
            text: '(2) The other panel moves to the match',
          },
        ],
      },
    ],
  },
]
