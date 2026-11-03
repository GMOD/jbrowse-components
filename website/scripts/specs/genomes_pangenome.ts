import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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

// Haplotypes chosen by name, for the figures whose page step names them.
export const PORTAL_LOCI = {
  amylase: {
    loc: 'chr1:103610001-103760000',
    lanes: ['HG01361#1', 'HG00133#2', 'HG00133#1', 'NA18608#2', 'HG00232#1'],
  },
  igl: {
    loc: 'chr22:22800001-22850000',
    lanes: ['HG00099#1', 'HG002#1', 'HG00097#1', 'HG002#2', 'HG01074#1'],
  },
}

interface LaunchSession {
  views: { tracks: unknown[]; [key: string]: unknown }[]
  sessionTracks?: object[]
}

// A launch as the HPRC page builds it, saved by scripts/fetch-hprc-launches.ts.
export function portalLaunchSession(
  locus: string,
  launch: string,
): LaunchSession {
  const file = new URL(`hprc_${locus}_${launch}.session.json`, import.meta.url)
  return JSON.parse(readFileSync(fileURLToPath(file), 'utf8'))
}

export function portalLaunch(locus: string, launch: string) {
  return sessionSpec(PORTAL_CONFIG, portalLaunchSession(locus, launch))
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
