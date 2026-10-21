import { sessionSpec } from '../screenshot-spec-helpers.ts'
import { GRAPH_DRAWN, cutNear, graphTrack, local } from './graph-fixtures.ts'

import type {
  ScreenshotSpec,
  SessionUrlSpec,
} from '../screenshot-spec-types.ts'

const CONFIG = local('test_data/graphgenomeview/pangenome_nonhuman.json')

// Mouse's densest bubble that fits the cut: one `cn` 524 row over 44 kb,
// inside one Dock2 intron, so the figure claims nothing coding.
const DOCK2_LOC = 'chr11:34,516,044-34,560,497'

// Force: this single 524-segment bubble is the page's counterexample to its
// "check the counts before the force layout" note. The other windows are
// chains.
const dock2Spec: ScreenshotSpec = {
  mode: 'url',
  name: 'pangenome/mouse_dock2',
  url: sessionSpec(CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'mm39',
        loc: DOCK2_LOC,
        tracks: [
          {
            trackId: 'mm39_ncbiRefSeq_ucsc',
            height: 48,
          },
          {
            trackId: 'mouse_minigraph_bubbles',
            type: 'LinearBasicDisplay',
            height: 52,
          },
          {
            trackId: 'mouse_minigraph_alleles',
            coverage: { show: false },
            sashimi: { show: false },
            height: 110,
          },
          graphTrack('mouse_minigraph_segments', {
            layoutMode: 'force',
            paneHeight: 600,
            color: { field: 'position' },
            layers: { bubbles: true },
          }),
        ],
      },
    ],
  }),
  readySelector: GRAPH_DRAWN,
  readyTimeout: 300000,
  viewportWidth: 1400,
  viewportHeight: 1150,
  tooltip: 'hide',
  annotations: [
    {
      type: 'text',
      text: 'C57BL/6J, the reference',
      fontSize: 18,
      leader: true,
      anchor: { graphNode: 's110010685+' },
      dx: 160,
      dy: -110,
    },
    {
      type: 'text',
      text: 'sequence C57BL/6J lacks',
      fontSize: 18,
      leader: true,
      anchor: { graphNode: 's110050877+' },
      dx: -150,
      dy: 120,
    },
  ],
}

const bovineVariantLane = (height: number) => ({
  trackId: 'bovine_pangenome_vcf',
  variants: { show: true },
  height,
})

const bovineGenes = {
  trackId: 'bosTau9_ncbiRefSeq_ucsc',
  height: 90,
}

const bovineOmia = {
  trackId: 'omia_cattle_variants',
  height: 60,
}

function bovineLocusSpec(
  name: string,
  loc: string,
  tracks: Record<string, unknown>[],
  viewportHeight: number,
  view: Record<string, unknown> = {},
): SessionUrlSpec {
  return {
    mode: 'url',
    name,
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          id: `${name.replace('/', '-')}-lgv`,
          assembly: 'bosTau9',
          loc,
          tracks,
          ...view,
        },
      ],
    }),
    readyTimeout: 300000,
    viewportWidth: 1400,
    viewportHeight,
    tooltip: 'hide',
  }
}

export const mouseCattleGraphSpecs: ScreenshotSpec[] = [
  dock2Spec,
  // The highlight is the 212 bp OMIA says the allele duplicates.
  bovineLocusSpec(
    'pangenome/bovine_polled',
    'chr1:2,428,800-2,429,800',
    [bovineOmia, bovineVariantLane(260)],
    580,
    {
      highlight: [
        {
          refName: 'chr1',
          start: 2429108,
          end: 2429320,
          color: 'rgba(255,193,7,0.30)',
        },
      ],
    },
  ),
  // At 260 the extra other-alt and no-call key rows push yak off the lane.
  {
    ...bovineLocusSpec(
      'pangenome/bovine_kit',
      'chr6:70,080,000-70,180,000',
      [
        bovineGenes,
        bovineVariantLane(300),
        graphTrack('bovine_minigraph_segments', {
          color: { field: 'position' },
          bubbleSpread: 'compress',
          paneHeight: 240,
          maxRegionBp: cutNear(100_000),
        }),
      ],
      920,
    ),
    readySelector: GRAPH_DRAWN,
  },
  {
    ...bovineLocusSpec(
      'pangenome/bovine_tas2r46',
      'chr5:98,575,000-98,615,000',
      [
        bovineGenes,
        bovineVariantLane(300),
        graphTrack('bovine_minigraph_segments', {
          color: { field: 'position' },
          bubbleSpread: 'compress',
          paneHeight: 240,
          maxRegionBp: cutNear(40_000),
        }),
      ],
      920,
    ),
    readySelector: GRAPH_DRAWN,
    annotations: [
      {
        type: 'text',
        text: 'deleted in gaur',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: 'bovine_pangenome_vcf',
          loc: 'chr5:98,600,000',
          fracY: 0.78,
        },
        dx: 60,
        dy: -120,
      },
    ],
  },
  {
    ...bovineLocusSpec(
      'pangenome/bovine_bola',
      'chr23:27,508,000-27,536,000',
      [
        bovineGenes,
        bovineVariantLane(260),
        {
          trackId: 'bovine_minigraph_alleles',
          coverage: { show: false },
          sashimi: { show: false },
          height: 90,
        },
        graphTrack('bovine_minigraph_segments', {
          layoutMode: 'force',
          bubbleSpread: 'compress',
          color: { field: 'position' },
          paneHeight: 420,
          maxRegionBp: cutNear(28_000),
        }),
      ],
      1190,
    ),
    readySelector: GRAPH_DRAWN,
    annotations: [
      {
        type: 'text',
        text: 'graph alleles, each sequence once, whichever assemblies have it',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: 'bovine_minigraph_alleles',
          loc: 'chr23:27,521,000',
          fracY: 0.45,
        },
        dx: 80,
        dy: -10,
      },
    ],
  },
  {
    mode: 'url',
    name: 'pangenome/bovine_whole_chromosome',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          id: 'bovine-chr23-lgv',
          assembly: 'bosTau9',
          loc: 'chr23',
          tracks: [
            'bosTau9_ncbiRefSeq_ucsc',
            'bovine_bubble_score',
            {
              trackId: 'bovine_minigraph_tier',
              type: 'LinearBasicDisplay',
              showLabels: 'none',
              height: 60,
            },
          ],
        },
      ],
    }),
    readyTimeout: 300000,
    viewportWidth: 1400,
    viewportHeight: 550,
    tooltip: 'hide',
    annotations: [
      {
        type: 'text',
        text: 'BoLA',
        fontSize: 18,
        leader: true,
        anchor: {
          trackId: 'bovine_bubble_score',
          loc: 'chr23:25,900,000',
          fracY: 0.15,
        },
        dx: -100,
        dy: -10,
      },
    ],
  },
]
