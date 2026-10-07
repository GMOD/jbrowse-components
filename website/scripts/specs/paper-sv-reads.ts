// The JBrowse 2 v5 paper's read-evidence supplementary figures, which the paper
// repo syncs from figures.lock. Two HG008-T benchmark loci in the read
// connection modes the paper's Method lists: a 13.3 kb tandem duplication
// (SV_128) beside a 26.7 kb deletion (SV_129) in SUZ12, and a 2.4 kb inversion
// on chr3 (SV_23, SV_25). One BAM mounts twice because a view shows a track
// once and a display draws one connection mode. The long reads group by split
// or not, so the chains that cross a junction sit under their arcs. Grouping
// splits coverage per group, so the long-read coverage is a track of its own.
// The short reads take two tracks, read arcs and the read cloud, each with the
// ordinary pairs kept as the background. The BAMs are slices of the
// GIAB files, and the calls a copy of the benchmark VCF, hosted because the GIAB FTP answers 503 to parallel renders.
import { cgiabUrl } from '../screenshot-spec-helpers.ts'

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
  type: 'LinearAlignmentsDisplay',
  showInterchrom: false,
  showLongRange: false,
  coverageHeight: 60,
  forceLoad: true,
}

const illuminaPairs = {
  ...connections,
  readConnectionsDown: true,
  color: { field: 'insertSizeAndOrientation' },
}

// What a band of a track is, hung from the track's own label as the
// translocation figure's are (`cgiab-junction.ts`).
const bandLabel = (
  text: string,
  trackLabel: string,
  dy: number,
): Annotation => ({
  type: 'text',
  text,
  fontSize: 16,
  anchor: { text: trackLabel, alignX: 'left', alignY: 'bottom', dx: 8, dy },
})

const HIFI_COV = 'hg008_t_hifi_coverage'
const HIFI_COV_NAME = 'HG008-T PacBio HiFi: coverage'
const HIFI_NAME = 'HG008-T PacBio HiFi: reads and arcs'
const ARCS_NAME = 'HG008-T Illumina: coverage and read arcs'
const PAIRS_NAME = 'HG008-T Illumina: read cloud'

const readEvidence = ({
  name,
  loc,
  arcsHeight,
  connectorCurves,
  coverageMax,
  viewportHeight,
}: {
  name: string
  loc: string
  arcsHeight: number
  // the loop of a read that maps back over itself; off where the curves of
  // inverted splits would cover the reads
  connectorCurves: boolean
  // caps the Illumina coverage axis where a spike in view would flatten it
  coverageMax?: number
  viewportHeight: number
}): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: cgiabUrl({
    sessionTracks: [
      {
        type: 'VariantTrack',
        trackId: CALLS,
        name: 'HG008-T V0.5 draft benchmark somatic SVs',
        assemblyNames: [GRCH38],
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: { uri: CALLS_VCF, locationType: 'UriLocation' },
          index: {
            indexType: 'TBI',
            location: { uri: `${CALLS_VCF}.tbi`, locationType: 'UriLocation' },
          },
        },
      },
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
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
            height: 60,
          },
          {
            trackId: CALLS,
            type: 'LinearVariantDisplay',
            height: 85,
          },
          // grouping splits coverage per group, so the whole-sample coverage
          // is a track of its own
          {
            ...connections,
            trackId: HIFI_COV,
            showPileup: false,
            height: 62,
          },
          {
            ...connections,
            trackId: HIFI,
            showCoverage: false,
            unit: 'chain',
            readConnections: 'arc',
            readConnectionsHeight: 60,
            // rows tall enough to show each maps-back loop
            featureHeight: connectorCurves ? 6 : 3,
            showBezierConnections: connectorCurves,
            height: connectorCurves ? 345 : 195,
            facet: 'splitRead',
            showLegend: true,
          },
          {
            ...illuminaPairs,
            trackId: ILLUMINA_ARCS,
            showPileup: false,
            readConnections: 'arc',
            readConnectionsHeight: arcsHeight,
            ...(coverageMax
              ? { scales: { y: { domainMax: coverageMax } } }
              : {}),
            height: arcsHeight + 70,
          },
          {
            ...illuminaPairs,
            trackId: ILLUMINA_PAIRS,
            showPileup: false,
            showCoverage: false,
            readConnections: 'cloud',
            showModalPairsInCloud: true,
            readConnectionsHeight: 200,
            height: 215,
            showLegend: true,
          },
        ],
      },
    ],
  }),
  annotations: [
    bandLabel('SV calls', 'draft benchmark somatic SVs', 52),
    bandLabel('PacBio: coverage', HIFI_COV_NAME, 36),
    bandLabel('PacBio: split-read arcs', HIFI_NAME, 38),
    bandLabel('PacBio: split reads', HIFI_NAME, 82),
    bandLabel('PacBio: unsplit reads', HIFI_NAME, connectorCurves ? 268 : 158),
    bandLabel('Illumina: coverage', ARCS_NAME, 44),
    bandLabel('Illumina: read-pair arcs', ARCS_NAME, 100),
    bandLabel('Illumina: read cloud', PAIRS_NAME, 40),
  ],
  hideSelectors: [APP_BAR],
  readyText: 'read cloud',
  readyTimeout: 300000,
  viewportWidth: 1500,
  viewportHeight,
})

export const paperSvReadsSpecs: ScreenshotSpec[] = [
  readEvidence({
    name: 'paper/sv_read_evidence',
    loc: 'chr17:31,937,000-32,030,000',
    coverageMax: 200,
    arcsHeight: 80,
    connectorCurves: true,
    viewportHeight: 1295,
  }),
  readEvidence({
    name: 'paper/sv_read_evidence_inversion',
    loc: 'chr3:184,709,000-184,723,000',
    arcsHeight: 110,
    connectorCurves: false,
    viewportHeight: 1175,
  }),
]
