// The JBrowse 2 v5 paper's read-evidence supplementary figures, which the paper
// repo syncs from figures.lock. Two HG008-T benchmark loci in the read
// connection modes the paper's Method lists: a 13.3 kb tandem duplication
// (SV_128) beside a 26.7 kb deletion (SV_129) in SUZ12, and a 2.4 kb inversion
// on chr3 (SV_23, SV_25). One BAM mounts twice because a view shows a track
// once and a display draws one connection mode. The BAMs are slices of the
// GIAB files, hosted because the GIAB FTP answers 503 to parallel renders.
import { cgiabUrl } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const GRCH38 = 'GRCh38_GIABv3'
const CGIAB = 'https://jbrowse.org/demos/cgiab'
const HIFI_BAM = `${CGIAB}/HG008-T_PacBio-HiFi-Revio_116x.sv_read_evidence_slices.bam`
const ILLUMINA_BAM = `${CGIAB}/HG008-T_Illumina_195x.sv_read_evidence_slices.bam`
const HIFI = 'hg008_t_hifi_chains'
const ILLUMINA_ARCS = 'hg008_t_illumina_arcs'
const ILLUMINA_CLOUD = 'hg008_t_illumina_cloud'

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
  drawInter: false,
  drawLongRange: false,
  coverageHeight: 60,
  forceLoad: true,
}

const illuminaPairs = {
  ...connections,
  readConnectionsDown: true,
  color: { field: 'insertSizeAndOrientation' },
}

const readEvidence = ({
  name,
  loc,
  pairsHeight,
  cloud,
  viewportHeight,
}: {
  name: string
  loc: string
  // the pairs that span a junction lay out under the ordinary ones, so the
  // track is as tall as the locus is deep
  pairsHeight: number
  cloud: boolean
  viewportHeight: number
}): ScreenshotSpec => ({
  mode: 'url',
  name,
  url: cgiabUrl({
    sessionTracks: [
      bamTrack(HIFI, 'HG008-T PacBio HiFi: chains and read arcs', HIFI_BAM),
      bamTrack(
        ILLUMINA_ARCS,
        'HG008-T Illumina: pairs and read arcs',
        ILLUMINA_BAM,
      ),
      bamTrack(ILLUMINA_CLOUD, 'HG008-T Illumina: read cloud', ILLUMINA_BAM),
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
            height: 70,
          },
          {
            trackId: 'hg008t_benchmark_sv',
            type: 'LinearVariantDisplay',
            height: 110,
          },
          {
            ...connections,
            trackId: HIFI,
            unit: 'chain',
            readConnections: 'arc',
            readConnectionsHeight: 70,
            featureHeight: 3,
            height: 315,
            showLegend: true,
          },
          {
            ...illuminaPairs,
            trackId: ILLUMINA_ARCS,
            unit: 'chain',
            readConnections: 'arc',
            drawProperPairArcs: false,
            readConnectionsHeight: 150,
            featureHeight: 1,
            height: pairsHeight,
            showLegend: true,
          },
          ...(cloud
            ? [
                {
                  ...illuminaPairs,
                  trackId: ILLUMINA_CLOUD,
                  showPileup: false,
                  readConnections: 'cloud',
                  readConnectionsHeight: 220,
                  height: 295,
                },
              ]
            : []),
        ],
      },
    ],
  }),
  readyText: 'pairs and read arcs',
  readyTimeout: 300000,
  viewportWidth: 1500,
  viewportHeight,
})

export const paperSvReadsSpecs: ScreenshotSpec[] = [
  readEvidence({
    name: 'paper/sv_read_evidence',
    loc: 'chr17:31,955,000-32,012,000',
    pairsHeight: 500,
    cloud: true,
    viewportHeight: 1660,
  }),
  readEvidence({
    name: 'paper/sv_read_evidence_inversion',
    loc: 'chr3:184,709,000-184,723,000',
    pairsHeight: 900,
    cloud: false,
    viewportHeight: 1725,
  }),
]
