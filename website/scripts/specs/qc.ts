import { displayPainted } from '@jbrowse/browser-test-utils'

import { HG38_HS1_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// website/docs/tutorials/mappability_qc.md. Every track but the read pileup
// comes from the hosted hg38 hub. `scripts/scan_mappability_qc.sh` emits the
// tutorial's numbers from these files; read it before moving a locus.
const HG38_HUB = 'https://jbrowse.org/ucsc/hg38/config.json'

// Frames the whole SMN cassette (SERF1A, SMN1, NAIP). Past ~143 bp/px the Umap
// lane averages its absent stretches away.
const SMN1_ZOOM_LOC = 'chr5:70,889,000-70,989,000'

// Wider than the GIAB and ENCODE flagged intervals, so both edges are in frame.
const OVERVIEW_LOC = 'chr5:69,200,000-71,700,000'

// gnomAD coverage recovers at 71.375 Mb, and nothing narrower shows the edge.
// The tutorial's control, chr5:71,455,000-71,485,000, is the right-hand fifth.
const WIDE_LOC = 'chr5:70,850,000-71,500,000'

const SMN_HIGHLIGHT = [
  { refName: 'chr5', start: 70_924_940, end: 70_953_012, assemblyName: 'hg38' },
  { refName: 'chr5', start: 70_049_523, end: 70_077_595, assemblyName: 'hg38' },
]

// Umap leaves unmappable positions absent, not zero, so an autoscaled axis
// hides the collapse. A bin's mean averages only the present positions and
// draws a wall near 1; `minScore` draws the worst one. At the 2.5 Mb overview
// no Umap setting shows the block, so that frame uses gnomAD coverage.
const mappabilityTrack = {
  trackId: 'hg38-umap100Quantitative',
  scales: { y: { domainMin: 0, domainMax: 1 } },
  y: 'minScore',
  extent: 'none' as const,
  height: 70,
}

// At 2 kb/px the default min-max extent paints the low-coverage block full
// height; `extent: 'none'` draws the mean alone.
const gnomadCoverageTrack = (height = 70, extent?: string) => ({
  trackId: 'hg38-gnomad3MeanCoverage',
  scales: { y: { domainMin: 0, domainMax: 40 } },
  height,
  ...(extent ? { extent } : {}),
})

const geneTrack = (height: number, onlyGenes: boolean) => ({
  trackId: 'hg38-ncbiRefSeqCurated',
  height,
  ...(onlyGenes ? { filter: { genes: 'only' } } : {}),
  // HIDE_ISOFORM_CHIP removes the "Longest isoform" chip this raises; a
  // session spec cannot arrive with the chip dismissed.
  geneGlyphMode: 'longestCoding',
})

const HIDE_ISOFORM_CHIP = ['.MuiChip-root']

// The app fills the sequenceAdapter from the hub's assembly.
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
      encoding: { color: 'mapq' },
      legend: { show: true },
      pileup: {
        // At the default height the lane hits "Max layout height reached" and
        // crops the pileup.
        readHeight: 2,
      },
      height: 300,
      // 100 kb of a 30x CRAM is past the byte gate, and a capture has nobody to
      // click the banner.
      forceLoad: true,
      // A collapsed-repeat pile-up otherwise runs the coverage axis to 1,600.
      scales: { y: { domainQuantile: 0.99 } },
    },
  ],
})

export const qcSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'qc/smn1_evidence',
    url: sessionSpec(HG38_HUB, {
      sessionTracks: [na12878Track],
      views: [panel(SMN1_ZOOM_LOC)],
    }),
    hideSelectors: HIDE_ISOFORM_CHIP,
    // At 723, which the blank-below report suggests, the run reports 110 px
    // clipped.
    viewportHeight: 844,
    annotations: [
      {
        type: 'text',
        text: 'Dark blue is MAPQ 0: mapped here, but they fit elsewhere just as well',
        fontSize: 20,
        maxWidth: 430,
        anchor: {
          trackId: 'na12878_qc_reads',
          loc: 'chr5:70,895,000',
          fracY: 0.22,
        },
      },
    ],
  },
  {
    mode: 'url',
    name: 'qc/smn_read_placement',
    url: sessionSpec(HG38_HUB, {
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
            gnomadCoverageTrack(90, 'none'),
            {
              trackId: 'na12878_qc_reads',
              encoding: { color: 'mapq' },
              legend: { show: true },
              forceLoad: true,
              scales: { y: { domainQuantile: 0.99 } },
              // A smaller featureHeight at 464 bp/px reaches the sparse tail of
              // the pack and breaks the MAPQ block into a picket fence.
              height: 260,
            },
          ],
        },
      ],
    }),
    viewportHeight: 805,
    hideSelectors: HIDE_ISOFORM_CHIP,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 600000,
    annotations: [
      {
        type: 'text',
        text: 'SMN1',
        fontSize: 18,
        maxWidth: 330,
        anchor: {
          trackId: 'hg38-gnomad3MeanCoverage',
          loc: 'chr5:70,925,000',
          alignX: 'left',
          fracY: 0.15,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'qc/smn_problematic_regions',
    url: sessionSpec(HG38_HUB, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: OVERVIEW_LOC,
          highlight: SMN_HIGHLIGHT,
          tracks: [
            { ...geneTrack(60, true), displayMode: 'compact' },
            gnomadCoverageTrack(100, 'none'),
            {
              trackId: 'hg38-alllowmapandsegdupregions',
              height: 40,
            },
            {
              trackId: 'hg38-lrSv1kgOnt',
              height: 100,
            },
          ],
        },
      ],
    }),
    viewportHeight: 622,
    hideSelectors: HIDE_ISOFORM_CHIP,
    annotations: [
      {
        type: 'text',
        text: 'mappability dip',
        fontSize: 19,
        maxWidth: 340,
        anchor: {
          trackId: 'hg38-gnomad3MeanCoverage',
          loc: 'chr5:70,400,000',
          fracY: 0.18,
        },
      },
      {
        type: 'text',
        text: 'few long-read calls',
        fontSize: 18,
        maxWidth: 340,
        anchor: {
          trackId: 'hg38-lrSv1kgOnt',
          loc: 'chr5:70,300,000',
          fracY: 0.55,
        },
      },
    ],
  },

  {
    mode: 'url',
    name: 'qc/smn_block_and_reads',
    url: sessionSpec(HG38_HUB, {
      sessionTracks: [na12878Track],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: OVERVIEW_LOC,
          highlight: SMN_HIGHLIGHT,
          tracks: [
            { ...geneTrack(60, true), displayMode: 'compact' },
            gnomadCoverageTrack(90, 'none'),
            {
              trackId: 'hg38-alllowmapandsegdupregions',
              height: 40,
            },
            {
              trackId: 'hg38-lrSv1kgOnt',
              height: 100,
            },
          ],
        },
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: WIDE_LOC,
          tracks: [
            geneTrack(60, true),
            mappabilityTrack,
            {
              trackId: 'na12878_qc_reads',
              encoding: { color: 'mapq' },
              legend: { show: true },
              forceLoad: true,
              scales: { y: { domainQuantile: 0.99 } },
              height: 260,
            },
          ],
        },
      ],
    }),
    viewportHeight: 1250,
    hideSelectors: HIDE_ISOFORM_CHIP,
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 600000,
    annotations: [
      {
        type: 'text',
        text: 'mappability dip',
        fontSize: 19,
        maxWidth: 340,
        anchor: {
          trackId: 'hg38-gnomad3MeanCoverage',
          loc: 'chr5:70,300,000',
          fracY: 0.18,
        },
      },
      {
        type: 'text',
        text: 'few long-read calls',
        fontSize: 18,
        maxWidth: 340,
        anchor: {
          trackId: 'hg38-lrSv1kgOnt',
          loc: 'chr5:70,300,000',
          fracY: 0.55,
        },
      },
      {
        type: 'text',
        text: 'SMN1',
        fontSize: 18,
        maxWidth: 330,
        anchor: {
          view: 1,
          trackId: 'hg38-umap100Quantitative',
          loc: 'chr5:70,940,000',
          alignX: 'left',
          fracY: 0.4,
        },
      },
    ],
  },

  // UCSC's hg38->hs1 liftOver chains this block to three overlapping places,
  // two of them reversed. The figure claims only that, not an inversion: SMN2
  // precedes SMN1 in both assemblies. The SMN array is 875 kb in hg38 and
  // 572 kb in hs1, so each window frames its own span and the widths differ.
  {
    mode: 'url',
    name: 'qc/smn_vs_t2t',
    url: sessionSpec(HG38_HS1_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          encoding: { color: 'strand', opacity: 0.5 },
          // Straight ribbons over this block blend into a wash; a curve gives
          // each of the three chains its own waist.
          mark: { interpolate: 'bump' },
          // 'off' draws each chain as an opaque slab, and 'full' is a hairball
          // over the segdup.
          cigarMode: 'matches',
          filter: [{ field: 'length', gte: 10000 }],
          levelHeights: [300],
          tracks: [['hg38_hs1_synteny']],
          views: [
            {
              assembly: 'hg38',
              // The chains end inside a narrower frame and look clipped.
              loc: 'chr5:69,450,000-71,550,000',
              tracks: [
                {
                  trackId: 'hg38-genes',
                  filter: { genes: 'only' },
                  // With every transcript, GTF2H2's ~25 grow this lane past
                  // 400 px and push the ribbon band out of frame.
                  geneGlyphMode: 'longestCoding',
                  heightMode: 'fixed',
                  height: 120,
                },
              ],
              trackLabels: 'offset',
            },
            {
              assembly: 'hs1',
              loc: 'chr5:70,210,000-71,980,000',
              tracks: [
                {
                  trackId: 'hs1-genes',
                  filter: { genes: 'only' },
                  geneGlyphMode: 'longestCoding',
                  // A session spec silently drops the legacy
                  // `showDescriptions: false`.
                  showLabels: 'name',
                  // Unpinned, RefSeq All's pseudogene rows grow this lane to
                  // ~450 px.
                  heightMode: 'fixed',
                  height: 200,
                },
              ],
              trackLabels: 'offset',
            },
          ],
        },
      ],
    }),
    viewportWidth: 1200,
    viewportHeight: 900,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 180000,
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
