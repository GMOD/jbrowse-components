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

const FLY_PAGE = 'https://genomes.jbrowse.org/pangenomes/fly'
const flyAnswer = (region: string) =>
  `${FLY_PAGE}/?region=${encodeURIComponent(region)}`

const RICE_PAGE = 'https://genomes.jbrowse.org/pangenomes/rice'
const riceAnswer = (region: string) =>
  `${RICE_PAGE}/?region=${encodeURIComponent(region)}`

const FORMS_MAP = '.ui-lanes'
const OPEN_IN_JBROWSE = '.ui-actions a.ui-btn'

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
  ...[
    { gene: 'cyp28d1', region: 'chr2L:5,200,001-5,220,000' },
    { gene: 'strn_mlck', region: 'chr2R:15,940,001-15,966,000' },
    { gene: 'chkov1', region: 'chr3R:25,320,001-25,335,000' },
  ].map(({ gene, region }): ScreenshotSpec => ({
    mode: 'url',
    name: `pangenome/genomes_fly_${gene}`,
    noSession: true,
    url: flyAnswer(region),
    readySelector: FORMS_MAP,
    readyTimeout: 180000,
    viewportWidth: 1100,
    viewportHeight: 850,
    liveLabel: 'Open the fly page',
    diffThreshold: 0.02,
  })),
  ...[
    { gene: 'sd1', region: 'chr1:39,008,001-39,020,000' },
    { gene: 'qsw5', region: 'chr5:5,374,001-5,390,000', height: 880 },
    { gene: 'pup1', region: 'chr12:15,866,141-15,866,870' },
  ].map(({ gene, region, height = 850 }): ScreenshotSpec => ({
    mode: 'url',
    name: `pangenome/genomes_rice_${gene}`,
    noSession: true,
    url: riceAnswer(region),
    readySelector: FORMS_MAP,
    readyTimeout: 180000,
    viewportWidth: 1100,
    viewportHeight: height,
    liveLabel: 'Open the rice page',
    diffThreshold: 0.02,
  })),
]
