import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { graphTrack } from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// graphRegionUrl in ~/src/jb2hubs/website/src/components/pangenomeLinks.ts
// builds the same session; re-copy it when that file moves a window or prop.
const HPRC_PAGE = 'https://genomes.jbrowse.org/pangenomes/hprc'
const HPRC_MHC_ANSWER = `${HPRC_PAGE}/?region=${encodeURIComponent('chr6:32,510,001-32,600,000')}`
export const PORTAL_CONFIG =
  'https://jbrowse.org/pangenome/hprc-grch38/config.json'

const MHC_WINDOW = { refName: 'chr6', start: 32510000, end: 32600000 }

const FORMS_MAP = '.ui-lanes'
const OPEN_IN_JBROWSE = 'a.ui-open'

// The graph launch after the tutorial's C4 step hides the variant matrix.
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
          {
            trackId: 'hg38_ncbiRefSeq_ucsc',
            geneGlyphMode: 'representative',
            displayMode: 'compact',
            height: 60,
          },
          graphTrack('hprc_minigraph_segments', {
            layoutMode,
            color: { field: 'position' },
            paneHeight: 320,
          }),
        ],
      },
    ],
  })
}

// GSTT1's lanes follow the order "Order lanes by structure" writes: four
// matching GRCh38, then six carrying the insertion.
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
        geneGlyphMode: 'representative',
        displayMode: 'compact',
        height: 60,
      },
      {
        trackId: 'hprc_v2_1_walk_lanes',
        type: 'MultiWaySyntenyDisplay',
        rows: { sort: lanes, kept: lanes },
        height: 51 * (lanes.length + 1),
      },
    ],
  }
}

export function portalHaplotypeLanes(locus: { loc: string; lanes: string[] }) {
  return sessionSpec(PORTAL_CONFIG, { views: [portalLanesView(locus)] })
}

export const genomesPangenomeSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'pangenome/genomes_hprc_loci',
    noSession: true,
    url: HPRC_MHC_ANSWER,
    readySelector: FORMS_MAP,
    readyTimeout: 180000,
    viewportWidth: 1100,
    viewportHeight: 850,
    liveLabel: 'Open the HPRC page',
    diffThreshold: 0.02,
    annotations: [
      {
        type: 'box',
        anchor: { selector: OPEN_IN_JBROWSE },
        strokeWidth: 3,
      },
    ],
  },
]
