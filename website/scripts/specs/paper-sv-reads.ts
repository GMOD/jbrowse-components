// The JBrowse 2 v5 paper's read-evidence supplementary figure, which the paper
// repo syncs from figures.lock. A 13.3 kb tandem duplication (SV_128) beside a
// 26.7 kb deletion (SV_129) in SUZ12, from the HG008-T benchmark, in the three
// read connection modes the paper's Method lists. One BAM mounts twice because
// a view shows a track once and a display draws one connection mode.
import { cgiabUrl } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const GRCH38 = 'GRCh38_GIABv3'
const FTP =
  'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab'
const HIFI_BAM = `${FTP}/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam`
const ILLUMINA_BAM = `${FTP}/BCM_Illumina-WGS_20240313/HG008-T_Illumina_195x_GRCh38-GIABv3.bam`
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
  showPileup: false,
}

export const paperSvReadsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/sv_read_evidence',
    url: cgiabUrl({
      sessionTracks: [
        bamTrack(HIFI, 'HG008-T PacBio HiFi: chains and read arcs', HIFI_BAM),
        bamTrack(ILLUMINA_ARCS, 'HG008-T Illumina: read arcs', ILLUMINA_BAM),
        bamTrack(ILLUMINA_CLOUD, 'HG008-T Illumina: read cloud', ILLUMINA_BAM),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: GRCH38,
          loc: 'chr17:31,955,000-32,012,000',
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
              readConnections: 'arc',
              drawProperPairArcs: false,
              readConnectionsHeight: 150,
              height: 225,
              showLegend: true,
            },
            {
              ...illuminaPairs,
              trackId: ILLUMINA_CLOUD,
              readConnections: 'cloud',
              readConnectionsHeight: 220,
              height: 295,
            },
          ],
        },
      ],
    }),
    readyText: 'read cloud',
    readyTimeout: 300000,
    viewportWidth: 1500,
    viewportHeight: 1385,
  },
]
