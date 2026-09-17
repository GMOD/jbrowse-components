import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { TOOLBAR_READY } from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The staging HPRC page and two of its launches. Each session is the one the
// page's link carries (haplotypeLanesUrl and graphRegionUrl in
// ~/src/jb2hubs/website/src/components/pangenomeLinks.ts, panels from
// public/pangenome-hprc/panels.json there), so re-copy them when that repo
// moves a window or regenerates a panel.
const PAGE = 'https://staging.genomes.jbrowse.org/pangenomes/hprc'
const CONFIG = encodeURIComponent(
  'https://jbrowse.org/pangenome/hprc-grch38/config.json',
)

const MHC_WINDOW = { refName: 'chr6', start: 32510000, end: 32600000 }
const LGV_ID = 'pangenome-locus-lgv'

// Where HG002#1, the panel's first lane, rejoins GRCh38 across the
// CFHR3-CFHR1 deletion, read off the lane track's two records for that walk.
const CFHR_DELETION = 'chr1:196,759,450-196,844,133'

const CFHR_PANEL = [
  'HG002#1',
  'HG00128#2',
  'HG00099#1',
  'HG00280#1',
  'HG00097#1',
  'HG00126#1',
  'HG00140#2',
  'HG005#1',
]

export const genomesPangenomeSpecs: ScreenshotSpec[] = [
  // Ends on the SMN1/SMN2 row, so the two rows with no graph launch are in
  // frame under the ones that have all four.
  {
    mode: 'url',
    name: 'pangenome/genomes_hprc_loci',
    noSession: true,
    url: PAGE,
    readyText: 'Whole chromosome',
    viewportWidth: 1100,
    viewportHeight: 975,
    settleMs: 2000,
    liveLabel: 'Open the HPRC page',
    diffThreshold: 0.02,
    annotations: [
      {
        type: 'box',
        anchor: { selector: 'tbody tr:first-child td:last-child a' },
        strokeWidth: 3,
      },
    ],
  },

  {
    mode: 'url',
    name: 'pangenome/genomes_hprc_mhc_graph',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          id: LGV_ID,
          assembly: 'hg38',
          loc: `${MHC_WINDOW.refName}:${MHC_WINDOW.start}-${MHC_WINDOW.end}`,
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'hprc_minigraph_bubbles',
            'hprc_minigraph_alleles',
            'hprc_minigraph_segments',
          ],
        },
        {
          type: 'GraphGenomeView',
          displayName: 'HLA / MHC graph',
          loadedTrackId: 'hprc_minigraph_segments',
          loadedRegion: { ...MHC_WINDOW, assemblyName: 'hg38' },
          connectedViewId: LGV_ID,
          colorScheme: 'reference-position',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 120000,
    settleMs: 4000,
    viewportHeight: 1310,
    hideTooltip: true,
  },

  {
    mode: 'url',
    name: 'pangenome/genomes_hprc_cfhr_haplotypes',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr1:196740000-196850000',
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            {
              trackId: 'hprc_v2_1_gbz_lanes',
              type: 'MultiWaySyntenyDisplay',
              laneFilter: { only: CFHR_PANEL },
              domain: CFHR_PANEL,
              height: 459,
            },
          ],
        },
      ],
    }),
    readySelector: displaySettled('multiway-synteny-display'),
    readyTimeout: 240000,
    settleMs: 15000,
    viewportHeight: 806,
    annotations: [
      {
        type: 'box',
        anchor: { track: 'hg38_ncbiRefSeq_ucsc', locus: CFHR_DELETION },
        strokeWidth: 3,
        fillOpacity: 0.08,
      },
    ],
  },
]
