import { displayPainted, encodeSessionSpec } from '@jbrowse/browser-test-utils'

import { HG38_HS1_CONFIG } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// website/docs/tutorials/mappability_qc.md — whether a locus can support the
// call you are reading off it, at SMN1/SMN2.
//
// EVERY TRACK BUT ONE COMES OUT OF THE HOSTED hg38 HUB, and that is the point
// of the page as much as the biology: genomes.jbrowse.org already publishes the
// mappability, problematic-region and callset tracks this asks for, so a reader
// applies the whole thing to their own locus by opening a URL. The exception is
// the read pileup, which no hub carries — a session track pointing at the
// public 1000 Genomes high-coverage CRAM.
//
// The numbers the tutorial quotes are all emitted by
// `scripts/scan_mappability_qc.sh`, against these same files. Read that script
// before changing a locus here; the control was chosen with it.
const HG38_HUB = `?config=${encodeURIComponent('https://jbrowse.org/ucsc/hg38/config.json')}`

// SMN1 and SMN2 are 99.9% identical over ~28 kb and sit ~900 kb apart, inside a
// segmental duplication that runs to about 1.5 Mb.
//
// 100 kb, up from the 30 kb this framed on for three rounds (reviewer, each of
// those rounds: "also zoom out more"). Two of them refused, on two facts, and
// only one of the two has survived:
//
//  - STILL TRUE. There is no edge within reach. gnomAD coverage over this block
//    is under 12x continuously from 69.5 Mb to 71.36 Mb, so the nearest place
//    the reads recover is 410 kb past SMN1's end -- widening towards it buys a
//    wider red block and no boundary, and the frame that HOLDS the boundary is
//    qc/smn_read_placement at 650 kb.
//  - NO LONGER TRUE, and it is what the refusals rested on: "a read panel
//    cannot be that wide", because at 200 kb the fetch is 4.61 Mb against the
//    byte gate and the lane renders its too-much-data banner instead of a
//    pileup. `forceLoad` is the declarative half of that banner's own FORCE LOAD
//    button, and the 650 kb frame below has been drawing a pileup through it
//    since. So the ceiling was a missing spec field, not the data.
//
// 100 kb is chosen for what is IN it rather than as a compromise: the whole SMN
// cassette -- SERF1A, SMN1 with SMN1-AS1, and NAIP -- so the
// frame says MAPQ 0 across a structure instead of across one gene. The Umap
// lane still works here -- at 71 bp/px the absent stretches have not started
// averaging in (they do by ~143), which is the other thing 200 kb would cost.
const SMN1_ZOOM_LOC = 'chr5:70,889,000-70,989,000'

// The control is chr5:71,455,000-71,485,000 — 30 kb over the 5' end of BDP1, on
// the same chromosome and out of the same library as SMN1, at the same width. It
// has no const of its own any more because no spec here frames on it: it is the
// right-hand fifth of WIDE_LOC below. The coordinate is written down because
// scan_mappability_qc.sh counts reads in it and the tutorial quotes the count —
// 7,147 at SMN1 against 7,662 here, so the two ends of that frame differ in
// where the reads can be put and not in how many there are, which is the entire
// claim and would not survive a control on another chromosome or sample.
//
// It is ordinary sequence by MEASUREMENT and not by margin: the script bins
// gnomAD coverage across the block, and the depression that starts at 69.5 Mb
// runs to 71.36 Mb and is over at 71.375. This window begins 40 kb past that.

// Wider than the whole flagged block (GIAB's low-mappability + segdup interval
// is chr5:69,533,889-71,009,585, ENCODE's blacklist interval is
// 69,540,700-71,359,500) so both edges are in frame. Cropped to the block, a
// reader cannot tell a flagged region from a track that covers everything.
const OVERVIEW_LOC = 'chr5:69,200,000-71,700,000'

// The read panel's own window, sized by where the reads recover rather than by
// what looks tidy: SMN1 sits at ~11% from the left, gnomAD coverage steps back
// up at 71.375 Mb (79%), and the BDP1 sequence the deleted control panel used is
// the right-hand fifth. See the note on the qc/smn_read_placement spec.
const WIDE_LOC = 'chr5:70,850,000-71,500,000'

// The two genes, banded in-app rather than annotated, so the reader can see
// which part of a 2.5 Mb frame is the pair everything else is about.
const SMN_HIGHLIGHT = [
  { refName: 'chr5', start: 70_924_940, end: 70_953_012, assemblyName: 'hg38' },
  { refName: 'chr5', start: 70_049_523, end: 70_077_595, assemblyName: 'hg38' },
]

// Umap k100: per position, the fraction of overlapping 100-mers that map
// uniquely. A position where no 100-mer is unique is ABSENT from the bigWig
// rather than stored as zero, so the lane goes blank rather than to the floor —
// which is why the axis is pinned to 0..1. Autoscaled, a window that is mostly
// absent scales to whatever few values survive and the collapse reads as an
// ordinary wiggle.
//
// LEGIBLE AT ANY WIDTH, WITH `summaryScoreMode: 'min'` — which is the whole of
// the answer to "should we show just plain mappability tracks?" and to the
// round after it ("consider adding mappability again. is it really a bad idea?
// i am confused why not"). The previous answer was that it is only readable at
// the 30 kb panels, and that was true of the DEFAULT summarization and only of
// that: a bigWig zoom bin carries min/avg/max, `avg` over a bin that is mostly
// absent is the average of the few present positions, and the lane came out a
// solid wall near 1 across a region where almost nothing maps. `min` over the
// same bin is the worst position in it, so the lane sits on the floor for the
// whole low-mappability block and steps to 1 at its edge — measured against the
// read track in qc/smn_read_placement, where the step lands at the same
// coordinate as the MAPQ 0 to MAPQ 60 transition and the gnomAD coverage step.
const mappabilityTrack = {
  trackId: 'hg38-umap100Quantitative',
  type: 'LinearWiggleDisplay',
  minScore: 0,
  maxScore: 1,
  summaryScoreMode: 'min' as const,
  height: 70,
}

// TRIED AT 2.5 Mb AND REMOVED, so it is not re-attempted. The hosted hub
// carries an `hg38-umap` MultiWiggleAdapter with all four read lengths (k24,
// k36, k50, k100), which is what "could add mappability wiggle files even as a
// multiwiggle since there are multiple" asks for, and it was rendered in the
// overview figure two ways. `min` at 2 kb a pixel is on the floor almost
// everywhere -- practically every 2 kb window in this part of chr5 contains at
// least one badly-mappable base, so the block does not stand out from the
// flanks. `avg` with a density ramp is vertical stripes at every k. The
// summarization that works at 464 bp a pixel (qc/smn_read_placement) does not
// survive being widened four times, and the overview figure keeps gnomAD
// coverage as its mappability-shaped lane instead.

// gnomAD's mean genome coverage over 76,156 samples. gnomAD discards
// non-uniquely-placed reads before computing it, so this lane is the Umap lane's
// prediction carried out on real data by someone else — an independent
// measurement, not a second view of the same file. Fixed 0..40 so the two panels
// share a scale and "a fraction of the depth next door" is legible without
// reading the axis.
//
// `summaryScoreMode` matters only in the 2.5 Mb frame and it is the difference
// between the figure working and not. At 2 kb a pixel the default `whiskers`
// draws each pixel's min AND max, so a stretch that averages 4x but touches 40x
// somewhere inside every pixel paints full height: the island came out as a
// blue wall of the same height as the sequence either side of it, with only the
// texture differing. `avg` draws the mean, and the block is then a plainly
// shorter plateau between two full-height flanks, which is what the figure is
// for (review: "i need to see the assembly quality increase on either side of
// this problematic region").
const gnomadCoverageTrack = (height = 70, summaryScoreMode?: string) => ({
  trackId: 'hg38-gnomad3MeanCoverage',
  type: 'LinearWiggleDisplay',
  minScore: 0,
  maxScore: 40,
  height,
  ...(summaryScoreMode ? { summaryScoreMode } : {}),
})

const geneTrack = (height: number, showOnlyGenes: boolean) => ({
  trackId: 'hg38-ncbiRefSeqCurated',
  type: 'LinearBasicDisplay',
  height,
  showOnlyGenes,
  // ONE TRANSCRIPT PER GENE (reviewer, on two of the three figures here: "use
  // longestisoform on the gene track"). Collapsing raises the display's loud
  // chip at the right edge of the lane — "Longest isoform" on this track, whose
  // UCSC bed2gff conversion drops the `tag=MANE Select` that NCBI's own GFF3
  // carries, so protein length is what picks — and in a 2.5 Mb frame
  // it lands on a gene label; that is why an earlier round named 'all' instead
  // and paid a stacked row per multi-transcript gene. The chip is chrome, so
  // HIDE_ISOFORM_CHIP takes it out of the capture rather than the collapsing
  // being given up for it. Its own dismissal cannot be used: that state is
  // volatile by design, so a session spec cannot arrive with it dismissed.
  geneGlyphMode: 'longestCoding',
})

// The chip above, removed at capture time. Every figure on this page carries a
// gene lane and none of them is about the isoform control.
const HIDE_ISOFORM_CHIP = ['.MuiChip-root']

// NA12878 at 30x on GRCh38, from the 1000 Genomes high-coverage release. Public,
// CORS-enabled, and needs no sequenceAdapter — the app fills that from the
// assembly the hub config already defines.
const NA12878_CRAM =
  'https://s3.amazonaws.com/1000genomes/1000G_2504_high_coverage/data/ERR3239334/NA12878.final.cram'

const na12878Track = {
  type: 'AlignmentsTrack',
  trackId: 'na12878_qc_reads',
  name: 'NA12878, 30x Illumina (1000 Genomes)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'CramAdapter',
    cramLocation: { uri: NA12878_CRAM },
    craiLocation: { uri: `${NA12878_CRAM}.crai` },
  },
}

// One panel of the two-locus figure: the annotation, an aggregate outcome, and
// the reads themselves, in that order, so a lane can be read against the one
// above it.
const panel = (loc: string) => ({
  type: 'LinearGenomeView',
  assembly: 'hg38',
  loc,
  tracks: [
    geneTrack(70, false),
    mappabilityTrack,
    gnomadCoverageTrack(),
    {
      trackId: 'na12878_qc_reads',
      // The current unified type. `LinearPileupDisplay` renders the same, since
      // migrateAlignmentsSnapshot remaps it, but it leaves the spec-recipe
      // check unable to resolve the display and so unable to give the figure's
      // "Color by" and "Show legend" a click-path.
      type: 'LinearAlignmentsDisplay',
      // Mapping-quality coloring is the only thing on screen that separates
      // "there are no reads here" from "there are reads and none of them can be
      // placed": both draw a pileup, and the default coloring draws the same
      // pileup. Red is MAPQ 0 and yellow MAPQ >= 60 (legendUtils.ts).
      colorBy: { type: 'mappingQuality' },
      // Opt-in per the display's own default. Without it the reader has to be
      // told what red means, which is exactly the caption-rescues-the-figure
      // failure the house rule names.
      showLegend: true,
      // Compact rows (review: "consider setting compact featureheight"), and it
      // is the aggregate that gains. At the default height the lane ran out of
      // rows and printed "Max layout height reached", so the pileup was a
      // cropped sample of the evidence with no way to tell how much had been
      // dropped -- which is the opposite of conveying aggregate quality. The
      // row gap that pairs with a small height is derived, not set here (see
      // featureSpacingForHeight), the same as cancer_sv's SUPER_COMPACT.
      // Nothing in this figure is read one read at a time: the claim is the
      // colour of the whole block.
      featureHeight: 2,
      height: 300,
      // 100 kb of a 30x CRAM is past the byte gate, and a capture has nobody to
      // click the banner. Same reason as the 650 kb frame below.
      forceLoad: true,
      // and the same fix that frame needed for the same reason: at 30 kb the
      // coverage band's `local` autoscale topped out near the library's real
      // depth, but over 100 kb it reaches a collapsed-repeat pile-up and the
      // axis ran to 1,600, drawing a 30x library as a flat line on the floor.
      // `localsd` is mean +/- numStdDev over what is in view, so the ceiling
      // comes from the window rather than from a number somebody picked.
      autoscale: 'localsd',
    },
  ],
})

export const qcSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'qc/smn1_evidence',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
      sessionTracks: [na12878Track],
      views: [panel(SMN1_ZOOM_LOC)],
    })}&sessionName=Screenshot`,
    hideSelectors: HIDE_ISOFORM_CHIP,
    // Compact rows let the whole pileup fit where it used to hit the layout
    // ceiling, so this came down from 820. Not to the 723 the blank-below
    // report suggested: at 723 the run reports 110 px CLIPPED instead, the two
    // heuristics disagreeing by more than either's slack, so this is set from
    // the render.
    viewportHeight: 790,
    // One label per panel, saying what its colour is (review: "unclear what we
    // are showing ... need red text annotations if possible"). The legend gives
    // the colours a name and the caption gives the lanes theirs; what neither
    // says is why a wall of one colour is the whole result.
    //
    // Over the pileup rather than beside it: at 30 kb every lane above it is
    // carrying signal, and a pileup is the one place on the frame where 400x50px
    // covers nothing a reader is counting — no single read is the point here.
    //
    // The pill says what the WHOLE FRAME shows, not which paralog the reads
    // also fit (review: "avoid discussion about smn2 in the red call out, just
    // discuss the 'big picture' about what we are seeing"). Naming SMN2 made it
    // a fact about one gene family; the reusable point is that depth is not
    // evidence -- the reads are stacked deep and the aligner still cannot say
    // which copy they came from, so anything called here inherits that.
    //
    // NOT "cannot be placed", which a first pass said and which is wrong on its
    // face (review: "they are all ostensibly mapped"). Every read in this lane
    // IS mapped, and drawn where it was mapped. MAPQ 0 says the aligner found
    // at least one other position that fits equally well, so the placement is
    // arbitrary among those -- a statement about confidence, not about failure.
    annotations: [
      {
        type: 'text',
        text: 'Red is MAPQ 0: mapped here, but they fit elsewhere just as well',
        fontSize: 20,
        maxWidth: 430,
        anchor: {
          track: 'na12878_qc_reads',
          locus: 'chr5:70,895,000',
          fracY: 0.22,
        },
      },
    ],
  },
  // qc/control_evidence was here and is DELETED (review: "zoom out even further
  // till we see non-problematic region ... and can delete part 2 of
  // screenshot"). It was the lower half of the compose below, a second 30 kb
  // panel over BDP1; that sequence is now the right-hand fifth of the single
  // frame, where the reader gets the comparison without a seam. CONTROL_LOC
  // survives as the coordinate `scan_mappability_qc.sh` counts reads in, which
  // is where the tutorial's 7,662 comes from.
  // ONE frame, where this was a two-part compose (review: "zoom out even further
  // till we see non-problematic region, then we will see good and bad areas in
  // same screenshot and can delete part 2").
  //
  // The objection recorded at SMN1_ZOOM_LOC above was that a wide read panel banners
  // instead of drawing — true when it was written, and no longer, because
  // `forceLoad` is the declarative half of the FORCE LOAD button. The rest of
  // that note still holds and is why this window is 650 kb rather than 200: the
  // depression runs continuously to 71.36 Mb, so the nearest sequence where the
  // reads recover is 410 kb past SMN1's end and anything narrower is a wider red
  // block with no edge in it.
  //
  // Two lanes came out on the way. Umap k100 is per-base and at 464 bp/px the
  // absent stretches average in with the present ones (the same reason it is not
  // in the 2.5 Mb figure). The gnomAD lane stays but switches to `avg` for the
  // same reason `whiskers` failed there: one 40x pixel inside a 4x stretch
  // paints the block full height.
  //
  // What is left is the comparison the compose made across a seam, made instead
  // across the x axis of one picture: a red pileup, the edge, and a
  // multi-coloured one, over a coverage lane that steps up at the same place.
  {
    mode: 'url',
    // RENAMED from qc/smn_vs_control (reviewer: "the naming 'vs_control' is
    // likely an outdated naming, we are not comparing now"). It was two 30 kb
    // panels, SMN1 against a control locus, composed; it has been one 650 kb
    // window with the recovery inside it since that compose was collapsed, so
    // the name outlived the comparison by two rounds.
    name: 'qc/smn_read_placement',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
      sessionTracks: [na12878Track],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: WIDE_LOC,
          highlight: [SMN_HIGHLIGHT[0]!],
          tracks: [
            geneTrack(60, true),
            mappabilityTrack,
            gnomadCoverageTrack(90, 'avg'),
            {
              trackId: 'na12878_qc_reads',
              type: 'LinearAlignmentsDisplay',
              colorBy: { type: 'mappingQuality' },
              showLegend: true,
              // 650 kb of 30x Illumina is past every byte budget in the stack,
              // and a capture has nobody to click the banner
              forceLoad: true,
              // The coverage band's own axis, which `local` autoscale had
              // running to 1,600 (review: "the 1600 is drowning out the
              // signal"). A handful of collapsed-repeat pile-ups set that
              // ceiling, so a 30x library drew as a 2%-height line and the
              // band carried nothing. `localsd` is the display's own answer to
              // peaky data — mean +/- numStdDev over what is in view — and it
              // is preferred here over a hand-picked maxScore because the
              // ceiling then comes from the window rather than from a number
              // somebody chose, and it survives the window being moved.
              autoscale: 'localsd',
              // 260, from 380 (review: "make it render even more compressed").
              // The lane is read as a colour FIELD -- red where nothing can be
              // placed uniquely, multi-coloured where the reads recover -- and
              // the field is the same field in two thirds of the height, because
              // what comes off is the BOTTOM of the pack.
              //
              // THE HEIGHT IS THE ONLY LEVER HERE; featureHeight is not, and it
              // was tried. The display's compact preset (3) fits about twice the
              // rows, and at 464 bp a pixel a 150 bp read is a third of a pixel
              // wide, so a row is a line of sub-pixel ticks rather than a bar:
              // the extra rows it reaches are the sparse tail of the pack, and
              // the lane came back a picket fence over white with the MAPQ block
              // broken up. Shorter at the default row height keeps every drawn
              // row inside the dense part of the pack, which is the field.
              height: 260,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    // 760 cut 42 css px off the bottom, from the run's own report; +95 more
    // for the mappability lane, then -120 with the pileup lane
    viewportHeight: 805,
    hideSelectors: HIDE_ISOFORM_CHIP,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 600000,
    settleMs: 30000,
    // WHY THE LOCUS IS WORTH THE TROUBLE (review: "put red text annotation that
    // the genes there are medically relevant"). Every lane in both frames says
    // the same thing about mappability, and none of them says why anyone would
    // sequence here anyway -- so the figure read as a hard region chosen for
    // being hard. It is the region a diagnosis is called from, and that is the
    // one thing about it a picture of read placement cannot carry.
    //
    // SMN1 alone, not the pair: SMN2 is 900 kb away and outside this frame,
    // which is the wide frame's own band. Its copy number is what modifies
    // severity, and that belongs in the prose beside the frame that shows both.
    //
    // In the coverage lane's upper fifth, the placement the wide frame's two
    // pills already use here: the axis runs to 40x and the depth over the block
    // is a fraction of it, so the top of the lane is empty and the pill covers
    // no signal.
    annotations: [
      {
        type: 'text',
        text: 'SMN1: biallelic loss causes spinal muscular atrophy',
        fontSize: 18,
        maxWidth: 330,
        anchor: {
          track: 'hg38-gnomad3MeanCoverage',
          locus: 'chr5:70,925,000',
          alignX: 'left',
          fracY: 0.15,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'qc/smn_problematic_regions',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: OVERVIEW_LOC,
          highlight: SMN_HIGHLIGHT,
          tracks: [
            { ...geneTrack(60, true), displayMode: 'compact' },
            // Reads well at this width where a mappability lane does not (see
            // the note above the mappability consts): the depth collapse is a
            // broad plateau rather than per-base structure, so summarizing it
            // into 2 kb pixels keeps it.
            // 100, from 120: the lane is read as a plateau against its flanks,
            // and the step is the same step at either height
            gnomadCoverageTrack(100, 'avg'),
            // ONE flagged-region lane, where this had two (reviewer: "we are
            // mixing gnomad coverage, giab problematic regions, encode
            // problematic regions, 1000g nanopore, etc. kind of too many
            // concepts. i just wanted to show user something about mappability.
            // try to simplify the message"). The ENCODE Blacklist V2 lane is
            // gone. It was here to make a second point -- the two projects
            // disagree by 350 kb on where the block ends -- and that point is
            // a fact about two annotation files rather than about mappability,
            // which is what this figure is for. GIAB's is the one kept because
            // it is the mappability annotation by name: low-mappability plus
            // segmental duplication.
            {
              trackId: 'hg38-alllowmapandsegdupregions',
              type: 'LinearBasicDisplay',
              height: 40,
            },
            // Folded in from qc/callsets_at_smn, which this replaces: what the
            // block does to a callset, over the same axis as the coverage that
            // explains it. PACKED, not collapsed — collapsed put a 2 kb record
            // and a 300 kb one on the same y and said nothing about either's
            // size (review: "it shouldnt even be collapsing large sv,
            // collapsing automatically was only meant for e.g. 1bp snps").
            {
              trackId: 'hg38-lrSv1kgOnt',
              type: 'LinearBasicDisplay',
              // 100, from 130 (review: "make it render even more compressed").
              // What is read off this lane is a HOLE, and a hole is as legible
              // in four rows of records as in five -- the rows that came off are
              // the ones furthest from the block, on both flanks at once.
              height: 100,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    // 780 - 40 for the ENCODE lane, then -50 across the coverage and callset
    // lanes
    viewportHeight: 690,
    hideSelectors: HIDE_ISOFORM_CHIP,
    // TWO PILLS, ONE MESSAGE. The previous pair said "coverage returns at
    // ENCODE's edge, 350 kb past GIAB's", which the review rejected on both
    // counts -- the possessive reads oddly and, more importantly, which
    // annotation file the coverage step lands on is not what the figure is
    // about. So each pill now says why its own lane is here, and both say the
    // same thing about mappability from a different direction.
    //
    // The coverage pill is the one that turns a depth lane into a mappability
    // lane: gnomAD drops non-uniquely-placed reads before averaging, so this
    // lane collapsing IS the mappability annotation carried out on 76,156
    // genomes. Nothing else on the frame says that, and without it a reader can
    // only conclude that the sequence is hard to sequence.
    //
    // The callset pill is the one review asked to make clearer ("which is kind
    // of interesting that even the nanopore 1000g callset cant resolve this.
    // which could be notable to mention more clearly"): the hole in that lane
    // is not a missing file, it is 1,019 long-read genomes producing no call.
    // The count is scan_mappability_qc.sh's, over this block against the
    // equal-width flanks either side: 2 records inside, 81 and 40 outside.
    //
    // Both sit in their lane's upper fifth, where the coverage axis runs to 40x
    // and the mean inside the block is under 12x, so nothing is covered.
    annotations: [
      {
        type: 'text',
        // same simplification pass as the pill below it
        text: 'the dip is mappability: reads that fit in two places are dropped',
        fontSize: 19,
        maxWidth: 340,
        anchor: {
          track: 'hg38-gnomad3MeanCoverage',
          locus: 'chr5:70,400,000',
          fracY: 0.18,
        },
      },
      {
        // PLAIN, on a second pass (reviewer: "'1,019 long-read genomes, 2 calls
        // inside the block' is still too dense of wording. more like 'even with
        // long read bam files, very few calls inside this block'"). The counts
        // are scan_mappability_qc.sh's and they belong in the prose, where there
        // is room to say what they are counts OF.
        type: 'text',
        text: 'even with long reads, very few calls in this block',
        fontSize: 18,
        maxWidth: 340,
        anchor: {
          track: 'hg38-lrSv1kgOnt',
          locus: 'chr5:70,300,000',
          fracY: 0.55,
        },
      },
    ],
  },

  // THE TWO SCALES AS ONE FIGURE (reviewer: "if this is a two part of zooming in
  // on qc/smn_problematic_regions, then just make it a two part figure"). They
  // were embedded two sections apart, with the T2T argument between them, and a
  // reader had to hold the 2.5 Mb frame in mind to know what the 650 kb one was
  // inside of. Stacked, the second frame is visibly a window into the first: the
  // block, then the reads in it.
  //
  // Both parts render at the default 1400 px, which is what makes a vertical
  // compose land square. Each stays reachable live on its own, which is why the
  // parts keep their names.
  //
  // STILL TWO FRAMES, and the follow-up review is answered by measuring rather
  // than by re-cropping ("why not just make this one single screenshot? can we
  // not load a bam file across 2.5mb? is there a shorter stretch of poor
  // mappability to help make our point").
  //
  // A BAM over 2.5 Mb: NA12878's 30x CRAM carries 11,221 reads in 50 kb here, so
  // the wide frame is around half a million of them -- several times the 5 MB
  // fetchSizeLimit both alignment adapters declare, which is force-loadable (the
  // read frame already force-loads its own 650 kb). The reason is geometry
  // rather than volume: 2.5 Mb over a 1400 px frame is ~1,800 bp a pixel, so a
  // 150 bp read is a twelfth of one. A lane there reports how much data is
  // present and nothing about where any of it landed, which is the entire claim
  // of the lower frame.
  //
  // A shorter stretch: there isn't one that says this. Measured off GIAB's own
  // alllowmapandsegdupregions over chr5:68-73 Mb -- the block is a single
  // 1,475,696 bp interval (69,533,889-71,009,585) with a second 435,173 bp one
  // 5.6 kb past it, and the next largest anywhere in those five megabases is
  // 4,222 bp. So the size IS the subject: the failure covers a whole gene
  // neighbourhood rather than scattered sites, and a window narrow enough to
  // make a read visible cannot show that it has edges.
  //
  // THE ZOOM, DRAWN (review: "might use the 'trapezoid' to show that figure 2
  // is a zoom in"). Stacked alone the lower frame was a second picture of the
  // same chromosome and nothing said which quarter of the upper one it is; the
  // wedge says it, and it lands where a reader can check it, because the block's
  // right-hand edge is visible in both.
  //
  // The gutter is what the wedge needs to exist in -- flush, the two facing
  // edges are one line and it has no height. 120 in the composition's own px,
  // 60 css px of either capture, paid for several times over by the two frames
  // coming down 170 css px between them.
  //
  // THE NARROW END IS SOLVED FOR, not assumed: the app's data area is inset by
  // its own margins, so the genomic fraction is not the image fraction. The
  // upper frame hands over four landmarks whose coordinates are known exactly --
  // the two edges of each SMN highlight band, which the view draws from
  // SMN_HIGHLIGHT -- and a least-squares fit over them gives
  //
  //   x = L + f * W  ->  L = 9.7, W = 2978.5  (3000 px wide, residuals < 0.8 px)
  //
  // the same data area dog10k-size-fst-scan and popgen/in2lt_inversion each
  // solved for independently against different landmarks. WIDE_LOC is then
  // 0.660-0.920 of that area, i.e. the fracX below. Re-derive by taking the
  // columns where the band's warm tint sits and fitting them against
  // SMN_HIGHLIGHT's own coordinates over OVERVIEW_LOC.
  {
    mode: 'compose',
    name: 'qc/smn_block_and_reads',
    parts: ['qc/smn_problematic_regions', 'qc/smn_read_placement'],
    direction: 'vertical',
    gutter: 120,
    annotations: [
      {
        type: 'trapezoid',
        fromAnchor: {
          selector: '[data-part="0"]',
          fracX: [0.6585, 0.9166],
        },
        anchor: { selector: '[data-part="1"]' },
      },
    ],
  },

  // qc/callsets_at_smn was here and is DELETED (review: "this is not a good
  // figure. i would suggest deleting ... furthermore this should just be
  // combined"). It was the same 2.5 Mb window as the figure above with DGV and
  // the long-read callset both collapsed to one row. Collapsing was the
  // complaint and the merge is the fix: the long-read lane moved up into the
  // island figure PACKED, where it sits under the coverage that explains its
  // hole, and DGV did not come with it. DGV's disagreement with the long-read
  // set is a count, not a picture -- packed it was eight rows of boxes wall to
  // wall with no individual record as the subject -- so it stays in the prose,
  // where scan_mappability_qc.sh's numbers already carry it.

  // The T2T control (review, on smn_problematic_regions: "if it helps show
  // synteny view to t2t"). It answers the question the page otherwise leaves
  // open -- whether the block is GRCh38's fault -- and the answer is no.
  //
  // Not a new file: the same UCSC hg38->hs1 liftOver PIF the genomes_synteny
  // figures already read, and the same test_data/hg38_hs1_synteny config.
  //
  // What the ribbons show, read out of that file rather than asserted (`tabix
  // hg38ToHs1.over.pif.gz tchr5:69200000-71700000`, chr5-to-chr5 records only):
  //   hg38 69,587,387-71,030,474  ->  hs1 70,423,158-71,497,205  REVERSE
  //   hg38 69,899,105-71,274,620  ->  hs1 70,662,997-71,697,444  REVERSE
  //   hg38 69,756,883-70,592,745  ->  hs1 71,089,404-71,778,022  forward
  // Three chains over one span, two of them inverted and all three overlapping
  // each other: the same GRCh38 sequence chains to more than one place in a
  // finished assembly, which is the same fact the Umap and MAPQ lanes state
  // per-base, arrived at from an independent direction.
  //
  // What the figure claims is only that: UCSC's own liftOver could not resolve
  // this block to ONE correspondence. It does NOT claim the block is inverted
  // between the two assemblies, and the gene order rules that out -- SMN2 comes
  // before SMN1 in both (hg38 70,049,523 then 70,924,940; hs1 70,809,743 then
  // 71,381,728). The reverse chains are copy-to-copy, which is what 99.9%
  // identity between an inverted pair of copies produces. colorBy 'strand' is
  // on so the two reverse chains are separable from the forward one, not as an
  // argument about the block's orientation.
  //
  // The two windows are each framed on their own SMN2..SMN1 span with 250 kb of
  // padding rather than on one shared width, because the array is not the same
  // size in the two assemblies -- 875 kb apart in hg38 against 572 kb in hs1 --
  // and that difference is a second thing the figure gets for free.
  {
    mode: 'url',
    name: 'qc/smn_vs_t2t',
    url: `?config=${encodeURIComponent(HG38_HS1_CONFIG)}&session=${encodeSessionSpec(
      {
        views: [
          {
            type: 'LinearSyntenyView',
            colorBy: 'strand',
            // CURVES, and they are what makes three overlapping chains
            // separable (review: "confusing screenshot ... maybe with
            // transparent cigar indels and showcurves"). Straight ribbons over
            // this block are three quadrilaterals that each span most of the
            // frame's width at both ends, so they overlap almost everywhere and
            // the band is a wash of blended colour with no edge to follow. A
            // curve pinches in the middle, so each ribbon has a waist the other
            // two do not share and the crossing reads as a crossing.
            drawCurves: true,
            // 'matches' is the menu's "Transparent indels": the ribbon is drawn
            // per CIGAR match block with the gaps left open, so the parts of a
            // chain that genuinely align are separated from the parts that only
            // sit between them. The previous 'off' drew each chain as one solid
            // slab hull, which is what made the band opaque; 'full' is the other
            // extreme and was rejected earlier for being a hairball of coloured
            // slivers over a segmental duplication. This is the middle setting
            // and the one the review asked for.
            cigarMode: 'matches',
            // drops the sub-kb chains the segdup throws off, leaving the three
            // that span the block
            minAlignmentLength: 10000,
            // three ribbons, so the 0.2 default is pure washout here -- there
            // is nothing piling up for it to protect
            alpha: 0.5,
            levelHeights: [300],
            tracks: [['hg38_hs1_synteny']],
            views: [
              {
                assembly: 'hg38',
                // 600 kb of padding either side of the SMN2..SMN1 span, where
                // this was 250 (review: "zoom out more please"). The three
                // chains all end inside the old frame, so their ends were the
                // frame's edges and could not be told apart from clipping.
                loc: 'chr5:69,450,000-71,550,000',
                tracks: [
                  {
                    trackId: 'hg38-genes',
                    showOnlyGenes: true,
                    // COLLAPSED to one transcript, the opposite of what
                    // geneTrack() above does, and for the opposite reason. Both
                    // tracks here are configured autoHeight, so 'all' is not a
                    // lane setting but a lane SIZE: GTF2H2 alone carries ~25
                    // transcripts and the hg38 lane grew past 400 px, taking the
                    // ribbon band off the bottom of the frame. The "Longest
                    // isoform" chip it costs lands on empty lane at this width.
                    geneGlyphMode: 'longestCoding',
                    heightMode: 'fixed',
                    height: 120,
                  },
                ],
                trackLabels: 'offset',
              },
              {
                assembly: 'hs1',
                // the same 600 kb of padding, on this assembly's own (shorter)
                // SMN2..SMN1 span — the two windows are deliberately not the
                // same width, see the note above
                loc: 'chr5:70,210,000-71,980,000',
                tracks: [
                  {
                    trackId: 'hs1-genes',
                    showOnlyGenes: true,
                    geneGlyphMode: 'longestCoding',
                    // review: "hide descriptions from t2t gene track". This is
                    // RefSeq All, so every pseudogene under the segdup carries a
                    // full product name in a second line of blue text, and at
                    // this width they run together into a band of unreadable
                    // type under a lane that is here for its gene ORDER.
                    //
                    // `showLabels: 'name'`, not `showDescriptions: false`: the
                    // two legacy slots were folded into one enum, and the old
                    // pair is converted by the schema's preprocessSnapshot at
                    // create time only. A session spec routes inline keys
                    // through `setSlot`, which needs a slot that still exists —
                    // so the legacy spelling would be dropped in silence here.
                    showLabels: 'name',
                    // PINNED, where the hg38 lane is merely capped. Both tracks
                    // are configured `grow`, and the hs1 GFF is RefSeq All: over
                    // this segdup it lays out seven rows of GUSB/POM121/cadherin
                    // pseudogenes and their descriptions, which grew the bottom
                    // lane to ~450 px and made the gene context taller than the
                    // ribbon band it is context FOR.
                    heightMode: 'fixed',
                    height: 200,
                  },
                ],
                trackLabels: 'offset',
              },
            ],
          },
        ],
      },
    )}&sessionName=Screenshot`,
    viewportWidth: 1200,
    // two gene lanes plus the 300px band, from the run's own "170 css px of
    // blank below the last content" at 1070
    viewportHeight: 900,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 180000,
    settleMs: 15000,
    // ANCHORED to the ribbon band, which this used to say was impossible: the
    // band is not a track, so annotationOverlay's model path (which resolves an
    // LGV's trackRefs) cannot reach it, and the caption was fixed css
    // coordinates justified by "this spec pins viewportWidth/Height and both
    // lane heights, so nothing under it can move".
    //
    // The band does have an element, and this spec was already waiting on it:
    // `synteny_canvas_done` is the readySelector above, so a `{selector}` anchor
    // resolves against the same canvas. The pinning argument was also weaker
    // than it read -- it held only while all four numbers stayed put, and three
    // of the four are the kind of thing a later edit changes for reasons that
    // have nothing to do with a caption. This one is the ratchet's own preferred
    // fix (`{selector}` for chrome) rather than a raised baseline.
    annotations: [
      {
        type: 'text',
        fontSize: 20,
        maxWidth: 420,
        anchor: {
          selector: displayPainted('synteny_canvas'),
          alignX: 'left',
          alignY: 'top',
          dx: 24,
          dy: 30,
        },
        text: 'The same GRCh38 sequence chains to more than one place in T2T',
      },
    ],
  },
]
