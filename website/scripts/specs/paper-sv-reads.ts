// The JBrowse 2 v5 paper's read-evidence supplementary figure, which the paper
// repo syncs from figures.lock. The benchmark's 20 kb homozygous CDKN2A
// deletion in HG008-T (SV_75), in the three read connection modes the paper's
// Method lists: HiFi split reads as chains under their arc, and Illumina pairs
// as a read cloud.
import { cgiabUrl } from '../screenshot-spec-helpers.ts'
import { HG008_T_PACBIO_BAM } from './sv.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const GRCH38 = 'GRCh38_GIABv3'
const HIFI = 'hg008_t_hifi_cdkn2a'
const ILLUMINA = 'hg008_t_illumina_cdkn2a'
const ILLUMINA_BAM =
  'https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/BCM_Illumina-WGS_20240313/HG008-T_Illumina_195x_GRCh38-GIABv3.bam'

const bamTrack = (trackId: string, name: string, uri: string) => ({
  type: 'AlignmentsTrack',
  trackId,
  name,
  assemblyNames: [GRCH38],
  adapter: {
    type: 'BamAdapter',
    fetchSizeLimit: 60_000_000,
    bamLocation: { uri, locationType: 'UriLocation' },
    index: {
      indexType: 'BAI',
      location: { uri: `${uri}.bai`, locationType: 'UriLocation' },
    },
  },
})

export const paperSvReadsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/sv_read_evidence',
    url: cgiabUrl({
      sessionTracks: [
        bamTrack(HIFI, 'HG008-T PacBio HiFi reads', HG008_T_PACBIO_BAM),
        bamTrack(ILLUMINA, 'HG008-T Illumina reads', ILLUMINA_BAM),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: GRCH38,
          loc: 'chr9:21,940,000-21,985,000',
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'hg38_ncbiRefSeq_ucsc',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
              height: 90,
            },
            {
              trackId: 'hg008t_benchmark_sv',
              type: 'LinearVariantDisplay',
              height: 70,
            },
            {
              trackId: HIFI,
              type: 'LinearAlignmentsDisplay',
              unit: 'chain',
              readConnections: 'arc',
              drawInter: false,
              coverageHeight: 60,
              readConnectionsHeight: 70,
              featureHeight: 3,
              height: 300,
              showLegend: true,
              forceLoad: true,
            },
            {
              trackId: ILLUMINA,
              type: 'LinearAlignmentsDisplay',
              readConnections: 'cloud',
              drawInter: false,
              readConnectionsDown: true,
              color: { field: 'insertSizeAndOrientation' },
              showLegend: true,
              showPileup: false,
              coverageHeight: 60,
              readConnectionsHeight: 260,
              height: 340,
              forceLoad: true,
            },
          ],
        },
      ],
    }),
    readyText: 'HG008-T Illumina',
    readyTimeout: 240000,
    viewportWidth: 1500,
    viewportHeight: 1135,
  },
]
