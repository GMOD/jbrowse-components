import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

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
// STAYS 30 kb, and the review that asked to widen it ("it is just 'all bad
// mappability', would be better to see 'island of badness'") was answered by
// measuring rather than by zooming. Two facts, both checked at 200 kb before
// this was put back:
//
//  - There is no edge within reach. gnomAD coverage over this block is under
//    12x continuously from 69.5 Mb to 71.36 Mb, so the nearest place the reads
//    recover is 410 kb past SMN1's end. 200 kb of extra width buys a wider red
//    block, not a boundary.
//  - A read panel cannot be that wide anyway. At 200 kb this window is a 4.61 Mb
//    fetch and the control 3.93 Mb, so both tracks render the too-much-data
//    banner instead of a pileup — the figure loses the only lane that shows one
//    read at a time. The Umap lane goes with it: at 143 bp/px the absent
//    stretches average in and it draws as a picket fence.
//
// The island's edges belong to qc/smn_problematic_regions, which carries the
// whole 2.5 Mb and names both of them. The page now leads with that figure and
// treats this pair as the zoom-in, which is the structural half of the same
// review ("i suggested zooming out, i need to see the assembly quality increase
// on either side of this problematic region").
const SMN1_LOC = 'chr5:70,924,000-70,954,000'

// The control, and the reason the pair of panels proves anything: 30 kb over
// the 5' end of BDP1, on the same chromosome and out of the same library as the
// SMN1 panel, at the same width. scan_mappability_qc.sh measures 7,147 reads at
// SMN1 and 7,662 here, so the panels differ in where the reads can be put and
// not in how many there are — which is the entire claim, and it would not
// survive a control on another chromosome or another sample.
//
// It is ordinary sequence by MEASUREMENT and not by margin: the script bins
// gnomAD coverage across the block, and the depression that starts at 69.5 Mb
// runs to 71.36 Mb and is over at 71.375. This window begins 40 kb past that.
const CONTROL_LOC = 'chr5:71,455,000-71,485,000'

// Wider than the whole flagged block (GIAB's low-mappability + segdup interval
// is chr5:69,533,889-71,009,585, ENCODE's blacklist interval is
// 69,540,700-71,359,500) so both edges are in frame. Cropped to the block, a
// reader cannot tell a flagged region from a track that covers everything.
const OVERVIEW_LOC = 'chr5:69,200,000-71,700,000'

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
// ONLY LEGIBLE AT THE 30 kb PANELS. At the 2.5 Mb overview each pixel summarizes
// ~2 kb, the absent stretches average in with the present ones, and the lane
// renders as a solid blue wall that says nothing — it was in that figure for one
// round and had to come out. If a wide-window version is ever wanted, it needs a
// different track (a binned mappability average), not this one.
const mappabilityTrack = {
  trackId: 'hg38-umap100Quantitative',
  type: 'LinearWiggleDisplay',
  minScore: 0,
  maxScore: 1,
  height: 70,
}

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
  // Collapsing to one transcript per gene raises the display's loud "Longest
  // isoform" chip at the right edge of the lane, which in the 2.5 Mb frames
  // lands on top of a gene label. Its dismissal is VOLATILE by design (a reload
  // is the reset boundary), so a session spec cannot pre-dismiss it — naming a
  // non-collapsing mode is what leaves the quiet icon instead. It costs a second
  // row on the multi-transcript genes even under `showOnlyGenes`, which is the
  // cheaper of the two blemishes: a stacked row is data, a chip over a label is
  // chrome.
  geneGlyphMode: 'all',
})

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
      height: 300,
    },
  ],
})

export const qcSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'qc/smn1_evidence',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
      sessionTracks: [na12878Track],
      views: [panel(SMN1_LOC)],
    })}&sessionName=Screenshot`,
    viewportHeight: 820,
    // One label per panel, saying what its colour is (review: "unclear what we
    // are showing ... need red text annotations if possible"). The legend gives
    // the colours a name and the caption gives the lanes theirs; what neither
    // says is why a wall of one colour is the whole result.
    //
    // Over the pileup rather than beside it: at 30 kb every lane above it is
    // carrying signal, and a pileup is the one place on the frame where 400x50px
    // covers nothing a reader is counting — no single read is the point here.
    annotations: [
      {
        type: 'text',
        text: 'Red is MAPQ 0 — each read fits SMN2 just as well',
        fontSize: 20,
        maxWidth: 430,
        anchor: {
          track: 'na12878_qc_reads',
          locus: 'chr5:70,926,500',
          fracY: 0.22,
        },
      },
    ],
  },
  {
    mode: 'url',
    name: 'qc/control_evidence',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
      sessionTracks: [na12878Track],
      views: [panel(CONTROL_LOC)],
    })}&sessionName=Screenshot`,
    viewportHeight: 820,
    // The other half of the same sentence, at the same height in the lane so the
    // two read as one comparison rather than as two remarks.
    annotations: [
      {
        type: 'text',
        text: 'Same library, same depth, 501 kb away — every read has one home',
        fontSize: 20,
        maxWidth: 430,
        anchor: {
          track: 'na12878_qc_reads',
          locus: 'chr5:71,457,500',
          fracY: 0.22,
        },
      },
    ],
  },
  {
    mode: 'compose',
    name: 'qc/smn_vs_control',
    parts: ['qc/smn1_evidence', 'qc/control_evidence'],
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
            geneTrack(60, true),
            // Reads well at this width where the mappability lane does not: the
            // depth collapse is a broad plateau rather than per-base structure,
            // so summarizing it into 2 kb pixels keeps it.
            gnomadCoverageTrack(120, 'avg'),
            // Two groups' opinions of the same sequence, as separate lanes: they
            // were drawn by different projects for different purposes and they
            // do not agree on where the region ends, which is only visible with
            // both on screen.
            {
              trackId: 'hg38-alllowmapandsegdupregions',
              type: 'LinearBasicDisplay',
              height: 40,
            },
            {
              trackId: 'hg38-encBlacklist',
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
              height: 130,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    viewportHeight: 780,
    // THIS is the figure that shows the island, which is why the read panels
    // above stay at 30 kb (see SMN1_LOC), and it now carries the callset lane
    // too. Where the island stops is settled by the coverage lane:
    // scan_mappability_qc.sh bins it across the block and it is under 12x
    // continuously to 71.35 Mb, 20.2x at 71.35 and 30.0x from 71.375 — so the
    // depression ends at ENCODE's boundary and not at GIAB's, 350 kb earlier.
    //
    // ONE pill on the coverage lane, not one per edge. Under `avg` the lane is
    // a full-height plateau, a low block and a full-height plateau, so where
    // the depth drops and where it returns need no labelling; what the picture
    // cannot say is WHICH annotation edge the return lands on. Both pills sit
    // in the lane's upper fifth, where the axis runs to 40x and the mean inside
    // the block is under 12x, so nothing is covered.
    annotations: [
      {
        type: 'text',
        text: "Coverage returns at ENCODE's edge, 350 kb past GIAB's",
        fontSize: 19,
        maxWidth: 330,
        textAlign: 'end',
        anchor: {
          track: 'hg38-gnomad3MeanCoverage',
          locus: 'chr5:71,160,000',
          fracY: 0.16,
        },
      },
      {
        type: 'arrow',
        fromAnchor: {
          track: 'hg38-gnomad3MeanCoverage',
          locus: 'chr5:71,175,000',
          fracY: 0.16,
        },
        anchor: {
          track: 'hg38-gnomad3MeanCoverage',
          locus: 'chr5:71,370,000',
          fracY: 0.16,
        },
      },
      {
        type: 'text',
        text: 'No long-read SV calls across the flagged block',
        fontSize: 18,
        maxWidth: 520,
        anchor: {
          track: 'hg38-lrSv1kgOnt',
          locus: 'chr5:70,300,000',
          fracY: 0.55,
        },
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
                loc: 'chr5:69,800,000-71,200,000',
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
                loc: 'chr5:70,560,000-71,660,000',
                tracks: [
                  {
                    trackId: 'hs1-genes',
                    showOnlyGenes: true,
                    geneGlyphMode: 'longestCoding',
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
    readySelector: '[data-testid="synteny_canvas_done"]',
    readyTimeout: 180000,
    settleMs: 15000,
    // Placed rather than anchored: the subject is the ribbon BAND, which is not
    // a track and so has no model element to anchor to (annotationOverlay's
    // model path resolves an LGV's trackRefs). Fixed css coordinates against a
    // pinned viewportWidth/Height and pinned lane heights, all four of which
    // this spec sets, so nothing under it can move without the numbers moving.
    annotations: [
      {
        type: 'text',
        x: 36,
        y: 372,
        fontSize: 20,
        maxWidth: 420,
        text: 'The same GRCh38 sequence chains to more than one place in T2T',
      },
    ],
  },
]
