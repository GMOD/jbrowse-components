import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { graphTrack } from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The staging HPRC page and its graph launch, which open pangenome_hprc. The
// session is the one the page's graph link carries (graphRegionUrl in
// ~/src/jb2hubs/website/src/components/pangenomeLinks.ts), so re-copy it when
// that repo moves a window or a launch prop.
const HPRC_PAGE = 'https://staging.genomes.jbrowse.org/pangenomes/hprc'
export const PORTAL_CONFIG = encodeURIComponent(
  'https://jbrowse.org/pangenome/hprc-grch38/config.json',
)

const MHC_WINDOW = { refName: 'chr6', start: 32510000, end: 32600000 }

// The HLA / MHC row's graph link, the first link in the Loci table's first row.
const MHC_GRAPH_LINK = 'tbody tr:first-child td:last-child a'

// `loc` and `layoutMode` move the launched session the way the tutorial's
// reader moves it after the launch.
export function portalGraphLaunch({
  loc = `${MHC_WINDOW.refName}:${MHC_WINDOW.start + 1}-${MHC_WINDOW.end}`,
  layoutMode = 'auto',
}: { loc?: string; layoutMode?: 'auto' | 'force' } = {}) {
  return sessionSpec(PORTAL_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        displayName: 'HLA / MHC graph',
        assembly: 'hg38',
        loc,
        tracks: [
          'hg38_ncbiRefSeq_ucsc',
          {
            trackId: 'hprc_minigraph_bubbles',
            type: 'LinearBasicDisplay',
            height: 90,
          },
          {
            trackId: 'hprc_minigraph_alleles',
            type: 'LinearAlignmentsDisplay',
            height: 120,
          },
          graphTrack('hprc_minigraph_segments', {
            layoutMode,
            colorScheme: 'reference-position',
          }),
        ],
      },
    ],
  })
}

// The haplotypes launch's window and lanes at three loci: CFH is the page's own
// panel for the locus (public/pangenome-hprc/panels.json in jb2hubs),
// amylase and GSTT1 the lanes the HPRC tutorials choose there. GSTT1's
// lanes are in the order "Order lanes by structure" writes: four that match
// GRCh38's chr22, then six carrying the GSTT1 insertion.
export const PORTAL_LOCI = {
  cfhr: {
    loc: 'chr1:196740001-196850000',
    lanes: ['HG00097#1', 'HG00253#2', 'HG00133#1', 'HG00235#2'],
  },
  amylase: {
    loc: 'chr1:103610001-103760000',
    lanes: ['HG01361#1', 'HG00133#2', 'HG00133#1', 'NA18608#2', 'HG00232#1'],
  },
  gstt1: {
    loc: 'chr22:23950001-24060000',
    lanes: [
      'HG00128#2',
      'HG01960#1',
      'HG00146#2',
      'HG01109#1',
      'HG00099#1',
      'HG00232#1',
      'HG00133#1',
      'HG00126#2',
      'HG00146#1',
      'HG00097#1',
    ],
  },
}

// haplotypeLanesForRegion's view, in the same jb2hubs file.
export function portalLanesView({
  loc,
  lanes,
}: {
  loc: string
  lanes: string[]
}) {
  return {
    type: 'LinearGenomeView',
    assembly: 'hg38',
    loc,
    tracks: [
      {
        trackId: 'hg38_ncbiRefSeq_ucsc',
        type: 'LinearBasicDisplay',
        geneGlyphMode: 'longestCoding',
        displayMode: 'compact',
        height: 60,
      },
      {
        trackId: 'hprc_v2_1_gbz_lanes',
        type: 'MultiWaySyntenyDisplay',
        rows: { domain: lanes, kept: lanes },
        height: 51 * (lanes.length + 1),
      },
    ],
  }
}

export function portalHaplotypeLanes(locus: { loc: string; lanes: string[] }) {
  return sessionSpec(PORTAL_CONFIG, { views: [portalLanesView(locus)] })
}

export const genomesPangenomeSpecs: ScreenshotSpec[] = [
  // Ends on the SMN1/SMN2 row, so the two rows with no graph launch are in
  // frame under the ones that have all five.
  {
    mode: 'url',
    name: 'pangenome/genomes_hprc_loci',
    noSession: true,
    url: HPRC_PAGE,
    readyText: 'Whole chromosome',
    viewportWidth: 1100,
    viewportHeight: 996,
    liveLabel: 'Open the HPRC page',
    diffThreshold: 0.02,
    annotations: [
      {
        type: 'box',
        anchor: { selector: MHC_GRAPH_LINK },
        strokeWidth: 3,
      },
    ],
  },
]
