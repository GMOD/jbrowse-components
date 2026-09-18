import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { TOOLBAR_READY } from './graph-fixtures.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The staging HPRC page and its graph launch. The session is the one the
// page's graph link carries (graphRegionUrl in
// ~/src/jb2hubs/website/src/components/pangenomeLinks.ts), so re-copy it when
// that repo moves a window.
const PAGE = 'https://staging.genomes.jbrowse.org/pangenomes/hprc'
const CONFIG = encodeURIComponent(
  'https://jbrowse.org/pangenome/hprc-grch38/config.json',
)

const MHC_WINDOW = { refName: 'chr6', start: 32510000, end: 32600000 }
const LGV_ID = 'pangenome-locus-lgv'

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
    viewportHeight: 1310,
    hideTooltip: true,
  },
]
