import { encodeSessionSpec } from '@jbrowse/browser-test-utils'

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
const SMN1_LOC = 'chr5:70,924,000-70,954,000'

// The control, and the reason the pair of panels proves anything: 30 kb over
// the 5' end of BDP1, 500 kb past the end of BOTH flagged intervals, on the
// same chromosome and out of the same library as the SMN1 panel, at the same
// width. scan_mappability_qc.sh measures 7,147 reads at SMN1 and 7,662 here, so
// the panels differ in where the reads can be put and not in how many there are
// — which is the entire claim, and it would not survive a control on another
// chromosome or another sample.
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
const gnomadCoverageTrack = (height = 70) => ({
  trackId: 'hg38-gnomad3MeanCoverage',
  type: 'LinearWiggleDisplay',
  minScore: 0,
  maxScore: 40,
  height,
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
  },
  {
    mode: 'url',
    name: 'qc/control_evidence',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
      sessionTracks: [na12878Track],
      views: [panel(CONTROL_LOC)],
    })}&sessionName=Screenshot`,
    viewportHeight: 820,
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
            gnomadCoverageTrack(90),
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
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    viewportHeight: 570,
  },

  {
    mode: 'url',
    name: 'qc/callsets_at_smn',
    url: `${HG38_HUB}&session=${encodeSessionSpec({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: OVERVIEW_LOC,
          highlight: SMN_HIGHLIGHT,
          tracks: [
            geneTrack(60, true),
            // DGV pools published CNV studies, most of them array-based, and
            // stacks its records; the long-read callset over 1,019 samples asks
            // the same question with reads that span the duplication. Neither
            // lane is the truth here — the figure shows that they disagree about
            // whether there is anything to report.
            {
              trackId: 'hg38-dgvMerged',
              type: 'LinearBasicDisplay',
              height: 160,
            },
            {
              trackId: 'hg38-lrSv1kgOnt',
              type: 'LinearBasicDisplay',
              height: 120,
            },
            {
              trackId: 'hg38-alllowmapandsegdupregions',
              type: 'LinearBasicDisplay',
              height: 40,
            },
          ],
        },
      ],
    })}&sessionName=Screenshot`,
    viewportHeight: 700,
  },
]
