// Figures for the pangenome_ecoli and multiway_synteny tutorials.
import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  cascadeBoxes,
  menuCascade,
  sessionSpec,
  trackMenuIcon,
} from '../screenshot-spec-helpers.ts'
import { ECOLI_DEMO_BASE, ecoliPageTrack } from './demoBase.ts'
import {
  GRAPH_DRAWN,
  GRAPH_VIEW_READY,
  graphCutDrawn,
  graphTrack,
  graphTrackMenu,
  cutNear,
  local,
  referencePositionColor,
} from './graph-fixtures.ts'
import { pageFenceText } from './pageTrack.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const CONFIG = local('test_data/graphgenomeview/config.json')
// The only fixture with the strains as assemblies, which the outbound launch
// needs.
const ECOLI_PANGENOME_CONFIG = local(
  'test_data/graphgenomeview/ecoli_pangenome.json',
)
const DATA = ECOLI_DEMO_BASE
const ECOLI_DOC = 'tutorials/pangenome_ecoli.md'
const ECOLI_SEGMENTS_TRACK = 'ecoli_minigraph_segments'

// The graph view's 'Stable rank' colors, so a segment's block and node match.
const RANK_COLOR_DEFAULTS = {
  encoding: {
    color: {
      field: 'rank',
      scale: {
        type: 'threshold',
        domain: [1],
        range: ['rgb(52,152,219)', 'rgb(237,137,44)'],
        names: ['reference', 'other assemblies'],
      },
      legend: { title: 'Segment rank' },
    },
  },
}

// A session track: the fixture config carries only the K12 assembly.
const ECOLI_SEGMENTS_SESSION_TRACK = {
  type: 'GraphTrack',
  trackId: ECOLI_SEGMENTS_TRACK,
  name: 'minigraph graph segments (rGFA)',
  assemblyNames: ['K12'],
  adapter: {
    type: 'RgfaTabixAdapter',
    uri: `${DATA}/ecoli_minigraph`,
  },
  displayDefaults: RANK_COLOR_DEFAULTS,
}

const PGGB_SEGMENTS_TRACK = 'ecoli_pggb_segments'
const PGGB_SEGMENTS_SESSION_TRACK = ecoliPageTrack(
  ECOLI_DOC,
  PGGB_SEGMENTS_TRACK,
)

const PGGB_CARRIAGE_TRACK = 'ecoli_pggb_carriage'
const PGGB_CARRIAGE_SESSION_TRACK = ecoliPageTrack(
  ECOLI_DOC,
  PGGB_CARRIAGE_TRACK,
)

const PGGB_DEPTH_TRACK = 'ecoli_pggb_depth'
const PGGB_DEPTH_SESSION_TRACK = ecoliPageTrack(ECOLI_DOC, PGGB_DEPTH_TRACK)

// An IS5 element at K12 chr:1,299,498-1,300,697 that the other four strains
// lack.
const PGGB_LOCUS = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1299300,
  end: 1300900,
}
const PGGB_LOCUS_WINDOW = 'chr:1,299,300-1,300,900'

// Wider windows put the 1.2 kb element in a sliver.
const PGGB_TIER_WINDOW = 'chr:1,292,500-1,307,500'
const PGGB_TIER_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1292500,
  end: 1307500,
}
const PGGB_TIER_TRACK = 'ecoli_pggb_tier50'
// `gfa-to-tabix build` keeps the element's segment whole, so the id is the
// fine graph's.
const PGGB_TIER_IS5_NODE = '160195'

// Variants under 50 bp folded into K12's segments; the IS5 element survives.
const PGGB_TIER_SESSION_TRACK = ecoliPageTrack(ECOLI_DOC, PGGB_TIER_TRACK)

const pggbTierCut = graphTrack(PGGB_SEGMENTS_TRACK, {
  color: {
    field: 'position',
    domainMin: PGGB_TIER_REGION.start,
    domainMax: PGGB_TIER_REGION.end,
  },
})

// pggb cuts a segment per variant, so a wider window is 6 px nodes. Here
// CFT073's contig reaches only the last 275 bp.
const PGGB_ROWS_LOCUS = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1004500,
  end: 1004961,
}
const PGGB_ROWS_WINDOW = 'chr:1,004,500-1,004,961'

// The graph folds variants narrower than 10 px, so the 1 bp alleles draw only
// below about 0.1 bp per px.
const PGGB_SAMPLE_ROWS_LOCUS = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 1004650,
  end: 1004740,
}
const PGGB_SAMPLE_ROWS_WINDOW = 'chr:1,004,651-1,004,740'

const PGGB_STRAIN_GRAPH = graphTrack(PGGB_SEGMENTS_TRACK, {
  layoutMode: 'force',
  color: { field: 'rank' },
  maxRegionBp: cutNear(PGGB_ROWS_LOCUS),
  paneHeight: 420,
  // bubble halos ran off the pane's edges
  layers: { bubbles: false },
})

// The five-assembly config: the node menu offers only assemblies the session
// has.
const PGGB_STRAIN_LAUNCH = sessionSpec(ECOLI_PANGENOME_CONFIG, {
  sessionTracks: [PGGB_SEGMENTS_SESSION_TRACK],
  views: [
    // K12 across the span the CFT073 segment bypasses
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: 'chr:996,800-1,005,900',
      tracks: [{ trackId: 'K12_genes' }],
    },
    // The 7.1 kb window above is thousands of nodes; the cap holds the cut to
    // the 460 bp one.
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: PGGB_ROWS_WINDOW,
      tracks: [PGGB_STRAIN_GRAPH],
    },
  ],
})

// The bubble at K12 chr:1,094,197-1,097,573
// (`tabix ecoli_minigraph_paths.bed.gz chr:1094000-1098000`).
const PATHS_WINDOW = 'chr:1,088,000-1,104,000'
// CFT073's 65 kb allele. `node scripts/probe-graph-nodes.ts
// pangenome/rgfa_hover_sync` prints the ids a cut contains.
const HOVERED_ALLELE = 's2037'

const SAME_SEGMENT_COLOR = '#1565c0'

const K12_GENES_SESSION_TRACK = {
  type: 'FeatureTrack',
  trackId: 'K12_genes',
  name: 'K12 genes',
  assemblyNames: ['K12'],
  adapter: {
    type: 'Gff3TabixAdapter',
    gffGzLocation: { uri: `${DATA}/K12.gff.gz` },
    index: { location: { uri: `${DATA}/K12.gff.gz.tbi` } },
  },
}

const K12_IS_TRACK = 'K12_insertion_sequences'
const K12_IS_SESSION_TRACK = {
  ...K12_GENES_SESSION_TRACK,
  trackId: K12_IS_TRACK,
  name: 'K12 insertion sequences',
}

// s1277 is the window's widest segment and its only one with a rank-2
// (CFT073) allele.
const ECOLI_WINDOW = 'chr:4,050,000-4,100,000'
const ECOLI_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 4050000,
  end: 4100000,
}
const SEGMENT_LABEL = 's1277'
const SEGMENT_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 4053156,
  end: 4067028,
}
const SEGMENT_WINDOW = 'chr:4,053,156-4,067,028'

// The paa island of multiway_synteny/ecoli_one_vs_all; only NCTC86's path
// walks s502. A file-loaded graph has no `loadedRegion`, so its ramp needs this
// span stated or it spans the whole file.
const PAA_RAMP_DOMAIN = { start: 1445000, end: 1474500 }

const PAA_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  ...PAA_RAMP_DOMAIN,
}

// s502 from the segs index: 21,809 bp, the `21.8 kb` label on its node.
const PAA_ISLAND_HIGHLIGHT = {
  refName: 'chr',
  start: 1446100,
  end: 1467909,
  color: 'rgba(214,137,16,0.13)',
}

// Each strain's whole island, from where Sakai's chain to K12 breaks
// (1,419,704-1,474,096) carried through Sakai's two offsets.
const PAA_K12_ISLAND_HIGHLIGHT = {
  refName: 'chr',
  start: 1419704,
  end: 1474096,
  label: 'K-12 island: paa operon',
  color: 'rgba(214,137,16,0.13)',
}
const PAA_SAKAI_ISLAND_HIGHLIGHT = {
  refName: 'chr',
  start: 1920861,
  end: 1990065,
  label: 'Sakai island: nleG effectors',
  color: 'rgba(214,137,16,0.13)',
}

// The window must be the cut's own region, or the lane's ramp and the graph's
// run over different spans.
const PAA_WINDOW = `chr:${PAA_RAMP_DOMAIN.start}-${PAA_RAMP_DOMAIN.end}`

// Every strain's flanking blocks rejoin K12 inside this window; narrower, a row
// opens on white with no flank
// (`tabix ecoli_pggb_ava.pif.gz 'qK12#1#chr:1330000-1560000'`).
const PAA_SYNTENY_WINDOW = 'chr:1,400,000-1,545,000'
// K12's window carried through each partner's left and right block offsets
// (NCTC86 +286,393 / +263,409, Sakai +501,157 / +515,969).
const PAA_NCTC86_WINDOW = 'chr:1,686,000-1,808,500'
const PAA_SAKAI_WINDOW = 'chr:1,901,000-2,061,000'

// Compact and genes only: three of these sit over two ribbon bands.
function strainGeneLane(trackId: string) {
  return {
    trackId,
    filter: ['geneLike'],
    displayMode: 'compact',
    height: 60,
  }
}

const ECOLI_AVA_TRACK = 'ecoli_pggb_ava'
// Pinned so the menu and callout resolve once the launch adds a second view.
const LAUNCH_OUT_VIEW = '[data-testid="view-container-launch_out_graph"]'

// Every strain's segments span 38-69 kb here. A strain with one small segment
// would open a synteny panel a few bp wide.
const LAUNCH_OUT_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 4400000,
  end: 4450000,
}
// The graph's reference-position ramp, so both frames share one rainbow.
const LAUNCH_OUT_SEGMENTS_TRACK = 'ecoli_minigraph_segments_by_position'
const LAUNCH_OUT_URL = sessionSpec(ECOLI_PANGENOME_CONFIG, {
  sessionTracks: [
    {
      ...ECOLI_SEGMENTS_SESSION_TRACK,
      trackId: LAUNCH_OUT_SEGMENTS_TRACK,
      displayDefaults: {
        encoding: {
          color: { value: referencePositionColor(LAUNCH_OUT_REGION) },
        },
      },
    },
  ],
  views: [
    {
      id: 'launch_out_graph',
      type: 'GraphGenomeView',
      loadedTrackId: LAUNCH_OUT_SEGMENTS_TRACK,
      loadedRegion: LAUNCH_OUT_REGION,
      layoutMode: 'force',
      color: { field: 'position' },
      layers: { genes: false },
    },
  ],
})

// CFT073 brings 58,692 bp here, where IAI39 and NCTC86 reach through 1 bp each.
// A wider cut pulls in the yersiniabactin island's second long CFT073 arm.
const PKS_REGION = {
  refName: 'chr',
  assemblyName: 'K12',
  start: 2056000,
  end: 2064000,
}
const PKS_VIEW = '[data-testid="view-container-pks_graph"]'

function ecoliHoverSession() {
  return sessionSpec(CONFIG, {
    sessionTracks: [
      K12_GENES_SESSION_TRACK,
      ECOLI_SEGMENTS_SESSION_TRACK,
      PGGB_MAF_SESSION_TRACK,
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: PATHS_WINDOW,
        tracks: [
          { trackId: 'K12_genes', height: 70 },
          {
            trackId: PGGB_MAF_TRACK,
            rows: { sort: PGGB_STRAIN_ROWS },
            height: 130,
          },
          // The halos and exon bars hid the reference nodes' hues.
          graphTrack(ECOLI_SEGMENTS_TRACK, {
            layoutMode: 'force',
            color: { field: 'position' },
            layers: { bubbles: false, genes: false },
            size: { field: 'depth', value: 10 },
            paneHeight: 420,
          }),
        ],
      },
    ],
  })
}

// The graph's sample-row order, which the MAF lanes pin to so a strain's row
// reads straight down both stacks.
const PGGB_STRAIN_ROWS = ['K12', 'CFT073', 'IAI39', 'NCTC86', 'Sakai']

const PGGB_MAF_TRACK = 'ecoli_pggb_maf'
const PGGB_MAF_SESSION_TRACK = ecoliPageTrack(ECOLI_DOC, PGGB_MAF_TRACK)

const PGGB_VARIANTS_TRACK = 'ecoli_pggb_variants'
const PGGB_VARIANTS_SESSION_TRACK = ecoliPageTrack(
  ECOLI_DOC,
  PGGB_VARIANTS_TRACK,
)

// A session spec naming one track twice keeps only the last display, so a
// second variant lane needs its own trackId.

// The halves of pggb_locus_sample_rows must differ only in layoutMode, so
// `mafLane` stays explicit.
function pggbLocusSession(
  layoutMode: 'force' | 'samplerows',
  {
    region,
    window,
    mafLane = false,
    variantLane = false,
    bubbleSpread,
    showBubbles,
    paneHeight = 600,
  }: {
    region: typeof PGGB_LOCUS
    paneHeight?: number
    window: string
    mafLane?: boolean
    variantLane?: boolean
    showBubbles?: boolean
    bubbleSpread?: 'auto' | 'open' | 'wide' | 'compress'
  },
) {
  return sessionSpec(CONFIG, {
    sessionTracks: [
      K12_GENES_SESSION_TRACK,
      PGGB_SEGMENTS_SESSION_TRACK,
      ...(mafLane ? [PGGB_MAF_SESSION_TRACK] : []),
      ...(variantLane ? [PGGB_VARIANTS_SESSION_TRACK] : []),
    ],
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'K12',
        loc: window,
        tracks: [
          { trackId: 'K12_genes', height: 70 },
          ...(variantLane
            ? [
                {
                  trackId: PGGB_VARIANTS_TRACK,
                  type: 'LinearMultiSampleVariantDisplay',
                  height: 110,
                },
              ]
            : []),
          ...(mafLane
            ? [
                {
                  trackId: PGGB_MAF_TRACK,
                  rows: { sort: PGGB_STRAIN_ROWS },
                  axis: { tree: true },
                  height: 150,
                },
              ]
            : []),
          // The cut stays near the window: at base level a wider one is a
          // braid.
          graphTrack(PGGB_SEGMENTS_TRACK, {
            layoutMode,
            paneHeight,
            color: {
              field: 'position',
              domainMin: region.start,
              domainMax: region.end,
            },
            maxRegionBp: cutNear(region),
            ...(bubbleSpread ? { bubbleSpread } : {}),
            ...(showBubbles === undefined
              ? {}
              : { layers: { bubbles: showBubbles } }),
          }),
        ],
      },
    ],
  })
}

// The paa island at Graph context None and at 1 hop. s2093 and s2095 are where
// a CFT073 detour leaves and rejoins the backbone, s2094 its interior, which
// only the hop reaches; at None the fold drops the 43 bp s2093. Keep the
// window: at 60 kb the boxed nodes shrink to specks, and 29.5 kb is the
// smallest that holds both.
function graphContextPartSpecs(): ScreenshotSpec[] {
  const DETOUR_ENTRY = 's2093+'
  const DETOUR_EXIT = 's2095+'
  const DETOUR_INTERIOR = 's2094+'
  // One color per node in both halves, so each pair reads across the composite.
  const ENTRY_COLOR = '#1a56db'
  const EXIT_COLOR = '#e8710a'
  const INTERIOR_COLOR = '#e3242b'
  const LABEL_COLOR = '#37474f'
  // Anchored on the canvas: the node-count readout's width moves with its
  // numbers.
  const label = (text: string): Annotation => ({
    type: 'text',
    text,
    anchor: {
      selector: '[data-testid="graph-genome-canvas"]',
      alignX: 'left',
      alignY: 'top',
    },
    dx: 12,
    // under the reference strip along the top of the track
    dy: 44,
    fontSize: 18,
    color: LABEL_COLOR,
  })
  const part = (
    name: string,
    subgraphContext: number,
    text: string,
  ): ScreenshotSpec => ({
    mode: 'url',
    name,
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PAA_WINDOW,
          // No island highlight: s502 fills three quarters of the window.
          tracks: [
            {
              trackId: 'K12_genes',
              filter: ['geneLike'],
              displayMode: 'compact',
              height: 60,
            },
            graphTrack(ECOLI_SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              color: { field: 'position' },
              maxRegionBp: cutNear(PAA_REGION),
              subgraphContext,
              // draws the 21.8 kb island as an arc, not a ring
              bubbleSpread: 'compress',
              // FMMM's top iteration budget
              layoutQuality: 4,
              // bubble labels differ between the cuts and read as the finding
              layers: { bubbles: false, genes: false },
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    // the 1 hop half queries every reached segment, so it fetches for longer
    readyTimeout: 180000,
    allowUnsettled: true,
    // half the composed width each
    viewportWidth: 750,
    // the 1 hop cut is the taller and sets this; re-measure at the reshoot
    viewportHeight: 912,
    tooltip: 'hide',
    annotations: [
      ...(
        [
          [DETOUR_ENTRY, ENTRY_COLOR],
          [DETOUR_EXIT, EXIT_COLOR],
        ] as const
      )
        .filter(
          ([graphNode]) => subgraphContext > 0 || graphNode !== DETOUR_ENTRY,
        )
        .map(([graphNode, color]): Annotation => ({
          type: 'box',
          anchor: { graphNode },
          strokeWidth: 3,
          color,
          // a wash survives thumbnail size, where a 3px outline does not
          fillOpacity: 0.1,
          // clear of the node's length label, which the graph draws across the
          // node
          pad: 22,
        })),
      label(text),
      ...(subgraphContext > 0
        ? [
            {
              type: 'circle',
              anchor: { graphNode: DETOUR_INTERIOR },
              radius: 26,
              strokeWidth: 3,
              color: INTERIOR_COLOR,
            } satisfies Annotation,
          ]
        : []),
    ],
  })
  return [
    part('pangenome/graph_context_none', 0, 'Graph context: None'),
    part('pangenome/graph_context_hop1', 1, 'Graph context: 1 hop'),
  ]
}

const regionLoc = ({
  refName,
  start,
  end,
}: {
  refName: string
  start: number
  end: number
}) => `${refName}:${start + 1}-${end}`

// The page's own fence, so the tour pastes the block the reader sees above it.
export const PGGB_SEGMENTS_TRACK_JSON = pageFenceText(
  ECOLI_DOC,
  PGGB_SEGMENTS_TRACK,
)

// Stays under maxFeatureScreenDensity with the drawer open: ~750 segments,
// against a gate of one per pixel.
const PGGB_TOUR_WINDOW = 'chr:1,290,000-1,310,000'

// Shared with website/scripts/video-specs.ts, so the tours' tracks and loci
// cannot drift from the figures'.
export const pggbVideoFixtures = {
  config: CONFIG,
  genesTrack: K12_GENES_SESSION_TRACK,
  locusWindow: PGGB_LOCUS_WINDOW,
  tourWindow: PGGB_TOUR_WINDOW,
  // The CFT073 allele pangenome/pggb_out_to_strain opens on its own strain.
  strainLaunchNode: '118465-',
  strainLaunchSession: PGGB_STRAIN_LAUNCH,
}

export const ecoliGraphSpecs: ScreenshotSpec[] = [
  // The pggb graph's coarse tier, variants under 50 bp folded. Force draws the
  // tier's chain as a thread with the IS5 box off-frame; keep it anchored.
  {
    mode: 'url',
    name: 'pangenome/pggb_bubble_tier',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        K12_GENES_SESSION_TRACK,
        K12_IS_SESSION_TRACK,
        PGGB_TIER_SESSION_TRACK,
        PGGB_MAF_SESSION_TRACK,
        PGGB_SEGMENTS_SESSION_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PGGB_TIER_WINDOW,
          highlight: [
            {
              assemblyName: 'K12',
              refName: 'chr',
              start: 1299498,
              end: 1300697,
              // light enough that the MAF rows under it still read blank
              color: 'rgba(21,101,192,0.12)',
            },
          ],
          tracks: [
            // The full gene lane leaves out insH21's label; this lane names it.
            {
              trackId: K12_IS_TRACK,
              filter: ["jexl:startsWith(get(feature,'name') || '','ins')"],
              height: 50,
            },
            {
              trackId: PGGB_TIER_TRACK,
              type: 'LinearBasicDisplay',
              labels: { name: { show: false }, description: { show: false } },
              height: 50,
              encoding: {
                color: { value: referencePositionColor(PGGB_TIER_REGION) },
              },
            },
            {
              trackId: PGGB_MAF_TRACK,
              rows: { sort: PGGB_STRAIN_ROWS },
              coverage: { show: false },
              height: 110,
            },
            { ...pggbTierCut, geneTrackId: 'K12_genes', height: 190 },
          ],
        },
      ],
    }),
    readySelector: graphCutDrawn('coarse'),
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 730,
    tooltip: 'hide',
    // No legend: a pill covered the Reference row's label.
    annotations: [
      {
        type: 'box',
        color: SAME_SEGMENT_COLOR,
        strokeWidth: 3,
        pad: 8,
        anchor: { graphNode: PGGB_TIER_IS5_NODE },
      },
    ],
  },
  // The depth lane is the carriage lane's control. Needs the fixture's plugin
  // bundle at 0093d998d280 or later, or `sampleCount` is absent and the lane
  // draws one color.
  // pangenome_prepare_graph's haplotypes-per-segment fence, verbatim but for
  // the hosted pggb index, so the figure draws the ramp the page configures.
  {
    mode: 'url',
    name: 'pangenome/prepare_graph_haplotypes_per_segment',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        {
          type: 'FeatureTrack',
          trackId: 'graph_haplotypes_per_segment',
          name: 'graph: haplotypes per segment',
          assemblyNames: ['K12'],
          adapter: {
            type: 'RgfaTabixAdapter',
            uri: 'https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb',
          },
          displayDefaults: {
            encoding: {
              color: {
                field: 'sampleCount',
                scale: {
                  type: 'linear',
                  domainMin: 1,
                  range: ['#e31a1c', '#bdbdbd'],
                },
                legend: { title: 'Haplotypes' },
              },
            },
          },
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1,296,000-1,304,000',
          tracks: [
            {
              trackId: 'graph_haplotypes_per_segment',
              type: 'LinearBasicDisplay',
              height: 175,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 390,
    tooltip: 'hide',
  },
  {
    mode: 'url',
    name: 'pangenome/pggb_carriage_lane',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        K12_GENES_SESSION_TRACK,
        PGGB_DEPTH_SESSION_TRACK,
        PGGB_CARRIAGE_SESSION_TRACK,
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: PGGB_LOCUS_WINDOW,
          tracks: [
            {
              trackId: 'K12_genes',
              height: 70,
              // the IS5's nameless record drew its raw RefSeq ID; insH21 names
              // the element
              filter: ["jexl:feature.type=='gene'"],
            },
            {
              trackId: PGGB_DEPTH_TRACK,
              height: 100,
            },
            {
              trackId: PGGB_CARRIAGE_TRACK,
              type: 'LinearBasicDisplay',
              // tall enough for the five-row legend the display floats over it
              height: 150,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 610,
    tooltip: 'hide',
    // Each pill sits where its lane is empty; on the left flank the depth pill
    // covered the axis ticks.
    annotations: [
      {
        type: 'text' as const,
        text: 'odgi depth, windowed',
        fontSize: 15,
        anchor: {
          trackId: PGGB_DEPTH_TRACK,
          loc: 'chr:1,300,000',
          fracY: 0.3,
        },
      },
      {
        type: 'text' as const,
        text: 'GFA SM:Z: tag, per segment',
        fontSize: 15,
        anchor: {
          trackId: PGGB_CARRIAGE_TRACK,
          loc: 'chr:1,299,340',
          fracY: 0.55,
        },
      },
    ],
  },
  // On a path GFA a sample row is carriage; on an rGFA it is only first-seen
  // attribution.
  {
    mode: 'url',
    name: 'pangenome/pggb_locus_sample_rows',
    url: pggbLocusSession('samplerows', {
      region: PGGB_SAMPLE_ROWS_LOCUS,
      window: PGGB_SAMPLE_ROWS_WINDOW,
      mafLane: true,
      // the halos stacked over the rows and a bubble label ran off the pane
      showBubbles: false,
      // five rows; at 600 they sat in the middle of a blank pane
      paneHeight: 220,
    }),
    // Row labels too: the layout runs after the graph loads, so the track holds
    // a cut before there is a row to label.
    readySelector: `body:has([data-testid="graph-row-label"]) ${GRAPH_DRAWN}`,
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 740,
    tooltip: 'hide',
    // The bar's own anchor is its polyline midpoint, thousands of px off the
    // left edge, so the pointer goes in from the graph's second row label,
    // CFT073's. A `text` anchor finds the MAF lane's label first.
    annotations: [
      {
        type: 'text',
        text: 'CFT073 skips this K12 span, and more off the left edge',
        fontSize: 16,
        maxWidth: 260,
        leader: true,
        anchor: {
          selector:
            '[data-testid="graph-row-label"] + [data-testid="graph-row-label"]',
          alignX: 'right',
          dx: 150,
        },
        dx: 330,
        dy: 45,
      },
    ],
  },
  // A view shows a track once, so the graph sits in a second view of the same
  // window.
  {
    mode: 'url',
    name: 'pangenome/rgfa_subgraph_launch',
    url: sessionSpec(CONFIG, {
      sessionTracks: [ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: ECOLI_WINDOW,
          tracks: [
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              encoding: {
                color: { value: referencePositionColor(ECOLI_REGION) },
              },
            },
          ],
        },
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: ECOLI_WINDOW,
          tracks: [
            // the shared ramp ties a block to its node
            graphTrack(ECOLI_SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              color: {
                field: 'position',
                domainMin: ECOLI_REGION.start,
                domainMax: ECOLI_REGION.end,
              },
              maxRegionBp: cutNear(ECOLI_REGION),
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 90000,
    viewportWidth: 1000,
    // re-measure at the reshoot
    viewportHeight: 1090,
    tooltip: 'hide',
    // s1278 is 5.8 kb of K12 and s2272 CFT073's 8.6 kb allele of it.
    annotations: [
      {
        type: 'box',
        color: SAME_SEGMENT_COLOR,
        strokeWidth: 3,
        pad: 11,
        anchor: {
          view: 0,
          trackId: ECOLI_SEGMENTS_TRACK,
          loc: 'chr:4,063,561-4,069,329',
          fracY: 0.1,
        },
      },
      {
        type: 'box',
        color: SAME_SEGMENT_COLOR,
        strokeWidth: 3,
        pad: 8,
        anchor: { view: 1, graphNode: 's1278' },
      },
      {
        type: 'circle',
        anchor: { view: 1, graphNode: 's2272' },
        radius: 20,
        strokeWidth: 3,
      },
      {
        type: 'text',
        text: 'CFT073 only, not in K12',
        fontSize: 15,
        maxWidth: 260,
        leader: true,
        anchor: { view: 1, graphNode: 's2272' },
        dx: -90,
        dy: 40,
      },
    ],
  },
  // Force-directed: an anchored layout draws the loop flat against the backbone
  // it replaces.
  {
    mode: 'url',
    name: 'pangenome/rgfa_paa_bubble',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          // ribbons draw between neighbouring rows only, so K12 sits in the
          // middle
          tracks: [ECOLI_AVA_TRACK],
          mark: { interpolate: 'bump' },
          // 70 is the floor: lower, the top band's unbroken run and the bottom
          // band's left edge stop being separable.
          levelHeights: [70, 70],
          views: [
            {
              assembly: 'NCTC86',
              loc: PAA_NCTC86_WINDOW,
              tracks: [strainGeneLane('NCTC86_genes')],
            },
            {
              assembly: 'K12',
              loc: PAA_SYNTENY_WINDOW,
              highlight: [PAA_K12_ISLAND_HIGHLIGHT],
              tracks: [
                strainGeneLane('K12_genes'),
                {
                  trackId: ECOLI_SEGMENTS_TRACK,
                  type: 'LinearBasicDisplay',
                  encoding: {
                    color: { value: referencePositionColor(PAA_RAMP_DOMAIN) },
                  },
                  height: 50,
                },
              ],
            },
            {
              assembly: 'Sakai',
              loc: PAA_SAKAI_WINDOW,
              // Unmarked, Sakai's side reads as a deletion.
              highlight: [PAA_SAKAI_ISLAND_HIGHLIGHT],
              tracks: [strainGeneLane('Sakai_genes')],
            },
          ],
        },
        {
          type: 'GraphGenomeView',
          // A file: `gfatools view -R … -r 1` walks the graph, where a track's
          // cut walks coordinate intervals and brings flanking backbone too.
          // scripts/build_ecoli_pangenome_graph.sh writes it.
          gfaLocation: { uri: `${DATA}/ecoli_paa_subgraph.gfa` },
          layoutMode: 'force',
          color: {
            field: 'position',
            domainMin: PAA_RAMP_DOMAIN.start,
            domainMax: PAA_RAMP_DOMAIN.end,
          },
          // `paneHeight` scales the drawing, where a shorter viewport clips the
          // bubble. Below 340 the per-node bp labels collide.
          paneHeight: 340,
          // the halo label named the island a second time, from K12's side only
          layers: { bubbles: false },
        },
      ],
    }),
    readySelector: GRAPH_VIEW_READY,
    readyTimeout: 120000,
    allowUnsettled: true,
    viewportWidth: 1000,
    // follows `paneHeight`: shortening the capture alone clips the bubble
    viewportHeight: 1190,
    tooltip: 'hide',
    annotations: [
      {
        type: 'circle',
        anchor: {
          view: [0, 1],
          trackId: ECOLI_SEGMENTS_TRACK,
          loc: `chr:${PAA_ISLAND_HIGHLIGHT.start}-${PAA_ISLAND_HIGHLIGHT.end}`,
        },
        // a ring sized to the whole ~150px block swallows its neighbours
        radius: 34,
      },
      {
        type: 'circle',
        anchor: { view: 1, graphNode: 's502' },
        // resolves to a point ON the node's polyline rather than its bounding
        // box, which for a node bent into an arc is the empty space inside it
        radius: 40,
      },
      // s1613 is off-reference (SR:i:1), so the K12 ramp paints it charcoal.
      {
        type: 'text',
        text: 'charcoal: the routes past the island',
        fontSize: 18,
        leader: true,
        anchor: { view: 1, graphNode: 's1613' },
        dx: 150,
        dy: 100,
      },
    ],
  },
  {
    mode: 'url',
    name: 'pangenome/rgfa_segment_neighbourhood',
    url: sessionSpec(CONFIG, {
      sessionTracks: [K12_GENES_SESSION_TRACK, ECOLI_SEGMENTS_SESSION_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          // matches the displayName on rgfa_strain_launch's view
          displayName: 'Linear genome view → graph',
          assembly: 'K12',
          loc: SEGMENT_WINDOW,
          tracks: [
            { trackId: 'K12_genes', height: 110 },
            {
              trackId: ECOLI_SEGMENTS_TRACK,
              type: 'LinearBasicDisplay',
              encoding: {
                color: { value: referencePositionColor(SEGMENT_REGION) },
              },
            },
          ],
        },
      ],
    }),
    readyText: SEGMENT_LABEL,
    readyTimeout: 90000,
    viewportWidth: 1000,
    // enough for the linear view plus the open track menu
    viewportHeight: 670,
    tooltip: 'hide',
    actions: [
      trackMenuIcon(ECOLI_SEGMENTS_TRACK),
      ...menuCascade(['Display types', 'Graph']),
    ],
    stages: [
      { annotations: cascadeBoxes(['Display types', 'Graph']) },
      {
        // the gene lane over a force drawing at the display's 300 px default;
        // re-measure at the reshoot
        viewportHeight: 680,
        closeMenusAfter: true,
        actions: [
          {
            type: 'click',
            selector: '[data-testid="cascading-menuitem-graph"]',
          },
          { type: 'waitForSelector', selector: GRAPH_DRAWN },
          ...graphTrackMenu(ECOLI_SEGMENTS_TRACK, [
            'Layout: Anchored',
            'Force-directed (FMMM)',
          ]),
          {
            type: 'waitForSelector',
            selector: `${GRAPH_DRAWN}[data-layout="force"]`,
          },
        ],
      },
    ],
  },
  // Each half is menu then result, so the two side by side make a 2x2. The
  // colors differ on purpose: stable rank asks whose arm, position asks where.
  {
    mode: 'compose',
    name: 'pangenome/rgfa_launch_roundtrip',
    parts: [
      'pangenome/rgfa_strain_launch',
      'pangenome/rgfa_segment_neighbourhood',
    ],
    columns: 2,
  },
  // Every node the hop adds here is a detour interior. Over the amylase window
  // the same hop gains 15 of 78 and the change vanishes in the tangle.
  ...graphContextPartSpecs(),
  {
    mode: 'compose',
    name: 'pangenome/graph_context',
    parts: ['pangenome/graph_context_none', 'pangenome/graph_context_hop1'],
    columns: 2,
  },
  // Graph to linear only: the reverse hover brightens a segment already
  // spanning the frame. A capture has no cursor, so the frame rings the target.
  {
    mode: 'url',
    name: 'pangenome/rgfa_hover_sync',
    url: ecoliHoverSession(),
    // The hover creates the highlight, so the waitForSelector action is what
    // fails a missed hover.
    readySelector: GRAPH_DRAWN,
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the gene and MAF lanes over the 420 graph pane; re-measure at the reshoot
    viewportHeight: 920,
    // `tooltip: 'hide'` hides only core's BaseTooltip, not the graph's own.
    actions: [
      { type: 'delay', ms: 3000 },
      { type: 'hover', anchor: { graphNode: HOVERED_ALLELE } },
      {
        type: 'waitForSelector',
        selector: '[data-testid="graph-node-highlight"]',
      },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { graphNode: HOVERED_ALLELE },
        radius: 22,
      },
      // Right of the loop: an annotation painted past the viewport edge raises
      // no error, and this one once sat below the frame.
      {
        type: 'text',
        text: 'the ringed node is sequence only CFT073 has',
        anchor: { graphNode: HOVERED_ALLELE },
        dx: 300,
        dy: -60,
        maxWidth: 230,
        fontSize: 16,
      },
      // s403 and s404 are the band's K12 span, where the loop leaves and
      // rejoins.
      {
        type: 'box',
        color: SAME_SEGMENT_COLOR,
        strokeWidth: 3,
        pad: 8,
        anchor: { graphNode: 's403' },
        fromAnchor: { graphNode: 's404' },
      },
      {
        type: 'text',
        // names CFT073: the pill sits in the upper panel, away from the node
        text: "the K12 span between the insert's two ends",
        color: SAME_SEGMENT_COLOR,
        // A bare locus anchor starts the pill at the band's midpoint; 'end'
        // against the left edge keeps it beside the band.
        textAlign: 'end',
        anchor: {
          trackId: 'K12_genes',
          loc: 'chr:1,095,502-1,097,564',
          alignX: 'left',
          fracY: 0,
          dx: -6,
          dy: -16,
        },
        fontSize: 16,
      },
    ],
  },
  // Each window is a PAF chain end plus ~12 kb of flank
  // (`tabix ecoli_pggb_ava.pif.gz 'tK12#1#chr:1050000-1150000'`), so the frame
  // edges map onto each other.
  {
    mode: 'url',
    name: 'pangenome/rgfa_insertion_synteny',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: [[ECOLI_AVA_TRACK]],
          mark: { interpolate: 'bump' },
          levelHeights: [200],
          views: [
            {
              assembly: 'K12',
              loc: 'chr:1,082,000-1,110,000',
              tracks: [strainGeneLane('K12_genes')],
            },
            {
              assembly: 'CFT073',
              loc: 'chr:1,115,000-1,253,000',
              tracks: [strainGeneLane('CFT073_genes')],
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
    // at 1000 px the gene lane loses the labels the caption reads
    viewportWidth: 1400,
    viewportHeight: 612,
    tooltip: 'hide',
    annotations: [
      {
        type: 'text',
        text: 'sequence only CFT073 has',
        fontSize: 18,
        anchor: {
          view: [0, 1],
          trackId: 'CFT073_genes',
          loc: 'chr:1,127,332-1,241,061',
          fracY: 0,
          dy: -70,
        },
      },
      {
        type: 'text',
        text: 'insertion site in K12',
        fontSize: 18,
        leader: true,
        anchor: {
          view: [0, 0],
          trackId: 'K12_genes',
          loc: 'chr:1,095,502-1,097,564',
          fracY: 1,
        },
        dx: 60,
        dy: 70,
      },
    ],
  },
  // A standalone graph view: a graph track's menu carries no synteny launch.
  {
    mode: 'url',
    name: 'pangenome/rgfa_launch_out_menu',
    url: LAUNCH_OUT_URL,
    readySelector: GRAPH_VIEW_READY,
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 580,
    tooltip: 'hide',
    stages: [
      {
        viewportHeight: 580,
        actions: [
          {
            type: 'click',
            selector: `${LAUNCH_OUT_VIEW} [data-testid="view_menu_icon"]`,
          },
          { type: 'click', text: 'Launch' },
          { type: 'waitForText', text: 'Linear synteny view' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          {
            type: 'box',
            anchor: {
              selector: `${LAUNCH_OUT_VIEW} [data-testid="view_menu_icon"]`,
            },
          },
          // Anchored by item text, so a box cannot land on a row the actions
          // skip.
          { type: 'box', anchor: { text: 'Launch' } },
          { type: 'box', anchor: { text: 'Linear synteny view' } },
        ],
      },
      {
        // Reloaded at its own height, since the synteny click launched nothing
        // at the first frame's height (below ~430)
        url: LAUNCH_OUT_URL,
        viewportHeight: 930,
        actions: [
          {
            type: 'click',
            selector: `${LAUNCH_OUT_VIEW} [data-testid="view_menu_icon"]`,
          },
          { type: 'click', text: 'Launch' },
          { type: 'click', text: 'Linear synteny view' },
          // the ribbons, not the panels: the panel headers paint long before
          // the PAF the whole point of the launch is
          {
            type: 'waitForSelector',
            selector: displayPainted('synteny_canvas'),
            timeout: 120000,
          },
          { type: 'waitForAppSettled' },
          // Closed after the launch: the menu item lives on the graph view.
          {
            type: 'click',
            selector: `${LAUNCH_OUT_VIEW} [data-testid="close_view"]`,
          },
          { type: 'waitForAppSettled' },
          {
            type: 'click',
            selector: '[aria-label="Synteny display settings"]',
          },
          { type: 'hover', text: 'CIGAR indels' },
          { type: 'click', text: 'Transparent indels' },
          { type: 'click', text: 'Curved lines' },
          { type: 'press', key: 'Escape' },
          { type: 'waitForText', text: 'Curved lines', hidden: true },
          {
            type: 'click',
            selector: '[data-testid="follow-synteny-toggle"]',
          },
          {
            type: 'waitForSelector',
            selector: displayPainted('synteny_canvas'),
            timeout: 120000,
          },
        ],
      },
    ],
  },
  {
    mode: 'url',
    name: 'pangenome/rgfa_strain_launch',
    url: sessionSpec(ECOLI_PANGENOME_CONFIG, {
      views: [
        {
          // pinned so the close click misses the view the launch adds
          id: 'pks_graph',
          type: 'LinearGenomeView',
          // the direction, paired with rgfa_segment_neighbourhood's
          displayName: 'Graph → linear genome view',
          assembly: 'K12',
          loc: regionLoc(PKS_REGION),
          tracks: [
            graphTrack(ECOLI_SEGMENTS_TRACK, {
              layoutMode: 'force',
              paneHeight: 600,
              color: { field: 'rank' },
              maxRegionBp: cutNear(PKS_REGION),
            }),
          ],
        },
      ],
    }),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 90000,
    viewportWidth: 1000,
    // the force drawing plus the node menu; re-measure at the reshoot
    viewportHeight: 820,
    tooltip: 'hide',
    stages: [
      {
        // This is also the height stage two ACTS at (a stage resizes after its
        // own actions), so it has to hold the launched view long enough for its
        // gene track to draw as well.
        viewportHeight: 820,
        actions: [
          { type: 'rightclick', anchor: { graphNode: 's2132' } },
          { type: 'waitForText', text: 'Open in CFT073' },
          { type: 'delay', ms: 500 },
        ],
        annotations: [
          { type: 'box', anchor: { text: 'Open in CFT073' } },
          // s2132 is CFT073#1#chr:2,258,597, 58,610 bp
          {
            type: 'text',
            text: 'CFT073 only',
            fontSize: 17,
            anchor: { graphNode: 's2132' },
            dy: -70,
          },
        ],
      },
      {
        // Re-opened rather than clicked out of the menu stage one left
        // standing: the resize between the two stages moves the menu under it.
        closeMenusFirst: true,
        // the launched view alone, once the K12 view has gone
        viewportHeight: 330,
        actions: [
          { type: 'rightclick', anchor: { graphNode: 's2132' } },
          { type: 'waitForText', text: 'Open in CFT073' },
          { type: 'click', text: 'Open in CFT073' },
          { type: 'waitForAppSettled' },
          {
            type: 'click',
            selector: `${PKS_VIEW} [data-testid="close_view"]`,
          },
          // a gene of the island itself, so the wait cannot pass on a view that
          // opened empty. clbK is 6.5 kb, the widest of them, so its label is
          // the first to render.
          {
            type: 'waitForSelector',
            selector: '[data-testid="feature-name-clbK"]',
            timeout: 120000,
          },
        ],
      },
    ],
  },
]
