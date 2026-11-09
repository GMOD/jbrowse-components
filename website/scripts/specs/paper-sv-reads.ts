// The JBrowse 2 v5 paper's read-evidence supplementary figures, which the paper
// repo syncs from figures.lock. One BAM mounts twice because a view shows a
// track once and a display draws one connection mode; grouping splits coverage
// per group, so the long-read coverage is a track of its own. The BAM slices
// and the benchmark VCF copy are hosted because the GIAB FTP answers 503 to
// parallel renders.
import { CGIAB_CONFIG, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const GRCH38 = 'GRCh38_GIABv3'
const CGIAB = 'https://jbrowse.org/demos/cgiab'
const HIFI_BAM = `${CGIAB}/HG008-T_PacBio-HiFi-Revio_116x.sv_read_evidence_slices.bam`
const ILLUMINA_BAM = `${CGIAB}/HG008-T_Illumina_195x.sv_read_evidence_slices.bam`
const CALLS = 'hg008t_benchmark_sv_hosted'
const CALLS_VCF = `${CGIAB}/GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz`
const HIFI = 'hg008_t_hifi_chains'
const ILLUMINA_ARCS = 'hg008_t_illumina_arcs'
const ILLUMINA_PAIRS = 'hg008_t_illumina_pairs'
const APP_BAR = 'header.MuiAppBar-root'

const bamTrack = (trackId: string, name: string, uri: string) => ({
  type: 'AlignmentsTrack',
  trackId,
  name,
  assemblyNames: [GRCH38],
  adapter: {
    type: 'BamAdapter',
    fetchSizeLimit: 80_000_000,
    bamLocation: { uri, locationType: 'UriLocation' },
    index: {
      indexType: 'BAI',
      location: { uri: `${uri}.bai`, locationType: 'UriLocation' },
    },
  },
})

const connections = {
  filter: [
    { field: 'connection.interchrom', equal: false },
    { field: 'connection.offscreen', equal: false },
  ],
  coverage: { height: 60 },
  // the read arcs below already draw each split junction
  sashimi: { show: false },
  forceLoad: true,
}

const illuminaPairs = {
  ...connections,
  readConnections: { placement: 'down' },
  encoding: { color: 'insertSizeAndOrientation' },
}

// The frame's width and its band labels' size: the paper prints these figures
// at its full text width, while the grant's derive from them at screen size
interface Print {
  viewportWidth: number
  labelFont: number
  // multiplies every track height, so a frame printed under a page-height cap
  // keeps its text large
  rowScale: number
}
const PAPER_PRINT = { viewportWidth: 910, labelFont: 18, rowScale: 0.5 }
export const SCREEN_PRINT = { viewportWidth: 1500, labelFont: 16, rowScale: 1 }

// What a band of a track is, hung from the track's own label as the
// translocation figure's are (`cgiab-junction.ts`). The dy is the label's
// baseline at screen size, which a larger font moves down by its growth.
const bandLabel = (
  text: string,
  trackLabel: string,
  dy: number,
  fontSize: number,
): Annotation => ({
  type: 'text',
  text,
  fontSize,
  anchor: {
    text: trackLabel,
    alignX: 'left',
    alignY: 'bottom',
    dx: 8,
    dy: dy + fontSize - SCREEN_PRINT.labelFont,
  },
})

// the view header, rulers and track labels, which no track height shrinks
const FIXED_CHROME = 472
// the read cloud's legend lists nine classes
const CLOUD_FLOOR = 138
// the read-pair arcs' band sits under a coverage band and a margin
const ARCS_MARGIN = 10
// lets a compact coverage band hold its label's box above the read-pair arcs
const COMPACT_COVERAGE_PAD = 6
// a track's label row and resize handle
const TRACK_CHROME = 41

// Labels hung from one track label keep a box's height between them
const stacked = (fontSize: number, labels: StackedLabel[]) =>
  labels.map(([text, track, dy], i) => {
    const above = labels
      .slice(0, i)
      .filter(l => l[1] === track)
      .at(-1)
    const placed = above ? Math.max(dy, above[2] + fontSize + 26) : dy
    labels[i] = [text, track, placed]
    return bandLabel(text, track, placed, fontSize)
  })

// text, track label and dy
type StackedLabel = [string, string, number]

// The PacBio reads track: its split-read arcs' band, and its labels as text
// and dy
interface ReadsBand {
  height: number
  rowHeight: number
  arcs: number
  labels: [string, number][]
}

// What a figure changes when its rows are scaled for the paper
interface PaperLayout {
  reads: ReadsBand
  width?: number
  hifiCoverage?: boolean
}

const SCREEN_READS: ReadsBand = {
  height: 345,
  rowHeight: 6,
  arcs: 60,
  labels: [
    ['PacBio: split-read arcs', 38],
    ['PacBio: split reads', 82],
    ['PacBio: unsplit reads', 268],
  ],
}

const callsTrack = (trackId: string, name: string) => ({
  type: 'VariantTrack',
  trackId,
  name,
  assemblyNames: [GRCH38],
  adapter: {
    type: 'VcfTabixAdapter',
    vcfGzLocation: { uri: CALLS_VCF, locationType: 'UriLocation' },
    index: {
      indexType: 'TBI',
      location: { uri: `${CALLS_VCF}.tbi`, locationType: 'UriLocation' },
    },
  },
})

const CALLS_NAME = 'HG008-T V0.5 draft benchmark somatic SVs'
const CALL_ARCS = 'hg008t_benchmark_sv_arcs'
const CALL_ARCS_NAME = 'HG008-T benchmark SV junctions'
const HIFI_COV = 'hg008_t_hifi_coverage'
const HIFI_COV_NAME = 'HG008-T PacBio HiFi: coverage'
const HIFI_NAME = 'HG008-T PacBio HiFi: reads and arcs'
const ARCS_NAME = 'HG008-T Illumina: coverage and read arcs'
const PAIRS_NAME = 'HG008-T Illumina: read cloud'

const readEvidence = ({
  name,
  loc,
  arcsHeight,
  coverageMax,
  viewportHeight,
  paper,
  print,
  h = (px: number) => Math.round(px * print.rowScale),
  compact = print.rowScale < 1,
  arcs = h(arcsHeight),
  illuminaCoverage = h(60) + (compact ? COMPACT_COVERAGE_PAD : 0),
  arcsTrack = arcs + illuminaCoverage + ARCS_MARGIN,
  layout = compact ? paper : { reads: SCREEN_READS },
  reads = layout.reads,
  hifiCoverage = layout.hifiCoverage ?? true,
}: {
  name: string
  loc: string
  arcsHeight: number
  // caps the Illumina coverage axis where a spike in view would flatten it
  coverageMax?: number
  viewportHeight: number
  paper: PaperLayout
  print: Print
  h?: (px: number) => number
  compact?: boolean
  arcs?: number
  illuminaCoverage?: number
  arcsTrack?: number
  layout?: PaperLayout
  reads?: ReadsBand
  hifiCoverage?: boolean
}): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: sessionSpec(CGIAB_CONFIG, {
    sessionTracks: [
      callsTrack(CALLS, CALLS_NAME),
      callsTrack(CALL_ARCS, CALL_ARCS_NAME),
      bamTrack(HIFI_COV, HIFI_COV_NAME, HIFI_BAM),
      bamTrack(HIFI, HIFI_NAME, HIFI_BAM),
      bamTrack(ILLUMINA_ARCS, ARCS_NAME, ILLUMINA_BAM),
      bamTrack(ILLUMINA_PAIRS, PAIRS_NAME, ILLUMINA_BAM),
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: GRCH38,
        loc,
        trackLabels: 'offset',
        tracks: [
          {
            trackId: 'hg38_ncbiRefSeq_ucsc',
            geneGlyphMode: 'representative',
            height: h(60),
          },
          {
            trackId: CALLS,
            height: h(85),
          },
          {
            trackId: CALL_ARCS,
            type: 'LinearMarkDisplay',
            height: h(70),
            marks: [
              {
                mark: 'link',
                transform: [{ type: 'mate' }],
                encoding: {
                  x2: { refName: 'mate.refName', pos: 'mate.start' },
                  strokeWidth: 2,
                },
              },
            ],
          },
          ...(hifiCoverage
            ? [
                {
                  ...connections,
                  coverage: { height: h(60) },
                  trackId: HIFI_COV,
                  pileup: { show: false },
                  height: h(62),
                },
              ]
            : []),
          {
            ...connections,
            trackId: HIFI,
            coverage: { ...connections.coverage, show: false },
            readConnections: { show: true, height: reads.arcs },
            // rows tall enough to show each maps-back loop and inversion hook
            pileup: { mark: { height: reads.rowHeight } },
            unit: 'chain',
            // paints each split segment by its strand against its molecule
            encoding: { color: 'insertSizeAndOrientation' },
            height: reads.height,
            facet: 'split',
            legend: { show: true },
          },
          {
            ...illuminaPairs,
            trackId: ILLUMINA_ARCS,
            pileup: { show: false },
            readConnections: {
              ...illuminaPairs.readConnections,
              show: true,
              height: arcs,
            },
            coverage: {
              ...illuminaPairs.coverage,
              height: illuminaCoverage,
              ...(coverageMax
                ? { encoding: { y: { scale: { domainMax: coverageMax } } } }
                : {}),
            },
            height: arcsTrack,
          },
          {
            ...illuminaPairs,
            trackId: ILLUMINA_PAIRS,
            pileup: { show: false },
            coverage: { ...illuminaPairs.coverage, show: false },
            readConnections: {
              ...illuminaPairs.readConnections,
              show: true,
              mark: 'rule',
              ordinaryPairs: { show: true },
              height: Math.max(h(215), CLOUD_FLOOR) - 15,
            },
            height: Math.max(h(215), CLOUD_FLOOR),
            legend: { show: true },
          },
        ],
      },
    ],
  }),
  annotations: stacked(print.labelFont, [
    ['SV calls', 'draft benchmark somatic SVs', 14 + h(38)],
    [compact ? 'SV calls as arcs' : 'SV call arcs', CALL_ARCS_NAME, 14 + h(22)],
    ...(hifiCoverage
      ? ([
          ['PacBio: coverage', HIFI_COV_NAME, 14 + h(22)],
        ] satisfies StackedLabel[])
      : []),
    ...reads.labels.map(
      ([text, dy]) => [text, HIFI_NAME, dy] satisfies StackedLabel,
    ),
    ...(compact
      ? ([
          ['Illumina: coverage and read-pair arcs', ARCS_NAME, 14 + h(30)],
        ] satisfies StackedLabel[])
      : ([
          ['Illumina: coverage', ARCS_NAME, 44],
          ['Illumina: read-pair arcs', ARCS_NAME, 100],
        ] satisfies StackedLabel[])),
    ['Illumina: read cloud', PAIRS_NAME, 14 + h(26)],
  ]),
  hideSelectors: [APP_BAR],
  readyText: 'read cloud',
  readyTimeout: 300000,
  viewportWidth: layout.width ?? print.viewportWidth,
  viewportHeight:
    FIXED_CHROME +
    h(viewportHeight - FIXED_CHROME) +
    Math.max(CLOUD_FLOOR - h(215), 0) +
    (arcsTrack - h(arcsHeight + 70)) +
    (reads.height - h(345)) -
    (hifiCoverage ? 0 : h(62) + TRACK_CHROME),
})

export const readEvidenceSpecs = (print: Print): ScreenshotSpec[] => [
  readEvidence({
    name: 'paper/sv_read_evidence',
    loc: 'chr17:31,937,000-32,030,000',
    coverageMax: 200,
    arcsHeight: 80,
    viewportHeight: 1386,
    paper: {
      reads: {
        height: 202,
        rowHeight: 4,
        arcs: 52,
        labels: [
          ['PacBio: split reads', 54],
          ['PacBio: unsplit reads', 180],
        ],
      },
    },
    print,
  }),
  readEvidence({
    name: 'paper/sv_read_evidence_inversion',
    loc: 'chr3:184,709,000-184,723,000',
    arcsHeight: 110,
    viewportHeight: 1416,
    paper: {
      reads: {
        height: 212,
        rowHeight: 4,
        arcs: 36,
        labels: [
          ['PacBio: split reads', 54],
          ['PacBio: unsplit reads', 207],
        ],
      },
      width: 884,
      hifiCoverage: false,
    },
    print,
  }),
]

export const paperSvReadsSpecs = readEvidenceSpecs(PAPER_PRINT)
