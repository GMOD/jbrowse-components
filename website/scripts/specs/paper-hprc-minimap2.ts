// The paper's supplementary figure for the gfa-to-pairwise-paf validation: the
// eight CFHR haplotypes as rows twice over, once from the alignments unpacked
// from the HPRC v2.1 graph (Figure 5's rows) and once from minimap2 -cx asm5 of
// the same contigs against GRCh38 chr1, so a reader can see the two agree at
// the 84.7 kb deletion.
import { displaySettled } from '@jbrowse/browser-test-utils'

import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = 'https://jbrowse.org/demos/hprc/config.json'

const HAPLOTYPES = [
  'HG01109.1',
  'HG01123.1',
  'HG01960.1',
  'HG02055.1',
  'HG00097.1',
  'HG00099.1',
  'HG00128.1',
  'HG00133.1',
]
const PIF_ASSEMBLIES = ['hg38', ...HAPLOTYPES]
const ASSEMBLY_TO_PANSN = Object.fromEntries([
  ['hg38', 'GRCh38#0'],
  ...HAPLOTYPES.map(h => [h, `${h.split('.')[0]}#1`]),
])

const pifTrack = (trackId: string, name: string, uri: string) => ({
  type: 'SyntenyTrack',
  trackId,
  name,
  assemblyNames: PIF_ASSEMBLIES,
  adapter: {
    type: 'MultiGenomeIndexedPAFAdapter',
    uri,
    csi: true,
    assemblyNames: PIF_ASSEMBLIES,
    assemblyNameToPanSN: ASSEMBLY_TO_PANSN,
  },
})

// The graph-derived rows are the config's own PIF lanes track; only the minimap2
// rows ride along as a session track.
const GRAPH_ROWS = 'hprc_v2_1_pif_lanes'
const MINIMAP2_ROWS = 'hprc_cfhr_minimap2'
const MINIMAP2_TRACK = pifTrack(
  MINIMAP2_ROWS,
  'HPRC release 2 haplotypes vs GRCh38, the same contigs aligned by minimap2 -cx asm5',
  'https://jbrowse.org/demos/hprc_multiway/hprc_cfhr_minimap2.pif.gz',
)

const CFHR_WINDOW = 'chr1:196,640,000-196,900,000'
const DELETION_LOCUS = 'chr1:196,810,000'

const ROW_ORDER = [
  'HG00097.1',
  'HG00099.1',
  'HG00128.1',
  'HG00133.1',
  'HG01109.1',
  'HG01123.1',
  'HG01960.1',
  'HG02055.1',
]

const lanes = (trackId: string) => ({
  trackId,
  rows: { sort: ROW_ORDER },
  height: 300,
  labels: { lanes: { placement: 'overlay' } },
})

const session = sessionSpec(CONFIG, {
  sessionTracks: [MINIMAP2_TRACK],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: CFHR_WINDOW,
      tracks: [
        {
          trackId: 'hg38_ncbiRefSeq_ucsc',
          geneGlyphMode: 'representative',
          displayMode: 'compact',
          height: 50,
        },
        lanes(GRAPH_ROWS),
        { ...lanes(MINIMAP2_ROWS), type: 'MultiWaySyntenyDisplay' },
      ],
    },
  ],
})

const settled = (trackId: string) =>
  `[data-testid$="-${trackId}"] ${displaySettled('multiway-synteny-display')}`
const BOTH_SETTLED = `body:has(${settled(GRAPH_ROWS)}) ${settled(MINIMAP2_ROWS)}`

const callouts: Annotation[] = [
  {
    type: 'text',
    text: '84.7 kb deletion',
    fontSize: 20,
    anchor: { trackId: GRAPH_ROWS, loc: DELETION_LOCUS, fracY: 0.56 },
  },
  {
    type: 'text',
    text: '84.7 kb deletion',
    fontSize: 20,
    anchor: { trackId: MINIMAP2_ROWS, loc: DELETION_LOCUS, fracY: 0.56 },
  },
]

export const paperHprcMinimap2Specs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'paper/hprc_rows_graph_vs_minimap2',
    url: session,
    viewportWidth: 1500,
    viewportHeight: 950,
    readySelector: BOTH_SETTLED,
    readyTimeout: 240000,
    tooltip: 'hide',
    annotations: callouts,
  },
]
