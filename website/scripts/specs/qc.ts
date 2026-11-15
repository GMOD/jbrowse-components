import { displayPainted } from '@jbrowse/browser-test-utils'

import { HG38_HS1_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// website/docs/tutorials/mappability_qc.md. Every track but the read pileup,
// Umap M100 and the Vienna ONT SVs comes from the hosted hg38 hub, which holds
// those two only inside its multi-tracks `hg38-umap` and
// `hg38-longReadVariants`. `scripts/scan_mappability_qc.sh` emits the
// tutorial's numbers from these files; read it before moving a locus.
const HG38_HUB = 'https://jbrowse.org/ucsc/hg38/config.json'

// Frames the whole SMN cassette (SERF1A, SMN1, NAIP). Past ~143 bp/px the Umap
// lane averages its absent stretches away.
const SMN1_ZOOM_LOC = 'chr5:70,889,000-70,989,000'

// Wider than the GIAB and ENCODE flagged intervals, so both edges are in frame.
const OVERVIEW_LOC = 'chr5:69,200,000-71,700,000'

// The overview's band marks the zoomed window in the compose trapezoid's own
// red, so band and wedge read as one shape.
const ZOOM_COLOR = 'rgba(227,36,43,0.14)'
const ZOOM_HIGHLIGHT = [
  {
    refName: 'chr5',
    start: 70_889_000,
    end: 70_989_000,
    assemblyName: 'hg38',
    color: ZOOM_COLOR,
  },
]

// A bp's x inside the overview part's data area, which the app's margins inset
// from the image (L = 12.4, W = 2976 of 3000 px); the app centres
// OVERVIEW_LOC on 69,200,297.
const overviewFrac = (bp: number) =>
  (12.4 + ((bp - 69_200_297) / 2_500_000) * 2976) / 3000

const UMAP_M100 = 'hg38-umap100Quantitative'

const umapTrack = {
  type: 'QuantitativeTrack',
  trackId: UMAP_M100,
  name: 'Multi-read mappability - Umap M100',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigWigAdapter',
    uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/hoffmanMappability/k100.Umap.MultiTrackMappability.bw',
  },
}

const LR_SV = 'hg38-lrSv1kgOnt'

const lrSvTrack = {
  type: 'FeatureTrack',
  trackId: LR_SV,
  name: 'Long-read SVs - 1KG Vienna ONT SVs',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BigBedAdapter',
    uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/lrSv/1kgOnt.bb',
  },
  displayDefaults: {
    encoding: {
      color: {
        field: 'svType',
        scale: {
          type: 'ordinal',
          domain: ['DEL', 'INS', 'CPX'],
          range: ['rgb(200,0,0)', 'rgb(0,0,200)', 'rgb(140,0,200)'],
          names: ['Deletion', 'Insertion', 'Complex'],
        },
        legend: { title: 'SV type' },
      },
    },
  },
}

// Umap leaves unmappable positions absent, not zero, so an autoscaled axis
// hides the collapse. A bin's mean averages only the present positions and
// draws a wall near 1; `minScore` draws the worst one. At the 2.5 Mb overview
// no Umap setting shows the block, so that frame uses gnomAD coverage.
const mappabilityTrack = {
  trackId: UMAP_M100,
  encoding: { y: { field: 'minScore', scale: { domainMin: 0, domainMax: 1 } } },
  mark: { extent: 'none' as const },
  height: 70,
}

// At 2 kb/px the default min-max extent paints the low-coverage block full
// height; `mark.extent: 'none'` draws the mean alone.
const gnomadCoverageTrack = (height = 70, extent?: string) => ({
  trackId: 'hg38-gnomad3MeanCoverage',
  encoding: { y: { scale: { domainMin: 0, domainMax: 40 } } },
  height,
  ...(extent ? { mark: { extent } } : {}),
})

const geneTrack = (height: number, onlyGenes: boolean) => ({
  trackId: 'hg38-ncbiRefSeqCurated',
  height,
  ...(onlyGenes ? { filter: ['geneLike'] } : {}),
  // HIDE_ISOFORM_CHIP removes the "Longest isoform" chip this raises; a
  // session spec cannot arrive with the chip dismissed.
  geneGlyphMode: 'representative',
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
  displayDefaults: { sashimi: { show: false } },
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
        mark: { height: 2 },
      },
      height: 300,
      // 100 kb of a 30x CRAM is past the byte gate, and a capture has nobody to
      // click the banner.
      forceLoad: true,
      // A collapsed-repeat pile-up otherwise runs the coverage axis to 1,600.
      coverage: { encoding: { y: { scale: { fenceQuantile: 0.99 } } } },
    },
  ],
})

export const qcSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'qc/smn1_evidence',
    url: sessionSpec(HG38_HUB, {
      sessionTracks: [na12878Track, umapTrack],
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
    name: 'qc/smn_problematic_regions',
    url: sessionSpec(HG38_HUB, {
      sessionTracks: [lrSvTrack],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: OVERVIEW_LOC,
          highlight: ZOOM_HIGHLIGHT,
          tracks: [
            { ...geneTrack(60, true), displayMode: 'compact' },
            gnomadCoverageTrack(120, 'none'),
            {
              trackId: 'hg38-alllowmapandsegdupregions',
              height: 40,
            },
            {
              trackId: LR_SV,
              height: 100,
            },
          ],
        },
      ],
    }),
    viewportHeight: 642,
    hideSelectors: HIDE_ISOFORM_CHIP,
    annotations: [
      {
        type: 'text',
        text: 'Typical coverage',
        fontSize: 19,
        maxWidth: 300,
        anchor: {
          trackId: 'hg38-gnomad3MeanCoverage',
          loc: 'chr5:71,650,000',
          alignX: 'right',
          fracY: 0.1,
        },
      },
      {
        type: 'text',
        text: 'Coverage stays low across the whole block',
        fontSize: 19,
        maxWidth: 340,
        anchor: {
          trackId: 'hg38-gnomad3MeanCoverage',
          loc: 'chr5:70,400,000',
          fracY: 0.15,
        },
      },
      {
        type: 'text',
        text: 'Few long-read SV calls inside the block',
        fontSize: 18,
        maxWidth: 340,
        anchor: {
          trackId: LR_SV,
          loc: 'chr5:70,300,000',
          fracY: 0.55,
        },
      },
    ],
  },

  {
    mode: 'compose',
    name: 'qc/smn_block_and_reads',
    parts: ['qc/smn_problematic_regions', 'qc/smn1_evidence'],
    gutter: 120,
    annotations: [
      {
        type: 'trapezoid',
        fromAnchor: {
          selector: '[data-part="0"]',
          fracX: [overviewFrac(70_889_000), overviewFrac(70_989_000)],
        },
        anchor: { selector: '[data-part="1"]' },
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
          indels: { encoding: { opacity: 0 } },
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
                  filter: ['geneLike'],
                  // With every transcript, GTF2H2's ~25 grow this lane past
                  // 400 px and push the ribbon band out of frame.
                  geneGlyphMode: 'representative',
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
                  filter: ['geneLike'],
                  geneGlyphMode: 'representative',
                  labels: { description: { show: false } },
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
