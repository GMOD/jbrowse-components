// The graph tours, on the pangenome pages: loading a graph and reading it at a
// locus, opening an allele on its strain, and the HPRC callset clustering.
import { menuCascade, sessionSpec } from '../screenshot-spec-helpers.ts'
import {
  PGGB_SEGMENTS_TRACK_JSON,
  pggbVideoFixtures,
} from '../specs/graph-ecoli.ts'
import { GRAPH_DRAWN } from '../specs/graph-fixtures.ts'
import { hprcClusterFixtures } from '../specs/graph-hprc.ts'
import { cactusVideoFixtures } from '../specs/pangenome_cactus.ts'
import { displayReady, trackMenu, zoomToSteps } from './shared.ts'

import type { VideoSpec, VideoStep } from '../video-spec-types.ts'

const {
  config: PGGB_CONFIG,
  genesTrack,
  locusWindow,
  tourWindow: PGGB_TOUR_WINDOW,
  strainLaunchNode: PGGB_STRAIN_NODE,
  strainLaunchSession: PGGB_STRAIN_LAUNCH,
} = pggbVideoFixtures

// K12 with its genes and nothing of the graph, 20 kb out from the IS5 element.
// The segments track is absent rather than hidden, because
// `doPasteConfigSubmit` rejects a `trackId` the session already holds.
const pggbTourStart = sessionSpec(PGGB_CONFIG, {
  sessionTracks: [genesTrack],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: PGGB_TOUR_WINDOW,
      tracks: [
        { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
      ],
    },
  ],
})

const cactusTourStart = sessionSpec(cactusVideoFixtures.config, {
  sessionTracks: [cactusVideoFixtures.genesTrack],
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'K12',
      loc: cactusVideoFixtures.tourWindow,
      tracks: [
        { trackId: 'K12_genes', type: 'LinearBasicDisplay', height: 70 },
      ],
    },
  ],
})

const GRAPH_WORKFLOW = 'Add pangenome graph track'
const URL_INPUT = '[data-testid="urlInput"]'
const SAMPLE_INPUT = '[data-testid="graph-sample-input"]'
const TRACK_NAME_INPUT = '[data-testid="graph-track-name-input"]'
const WORDMARK = '[aria-label="JBrowse"]'

// File → Open track... → Add pangenome graph track, the form, Submit: the one
// way both E. coli pages load a graph, each field read off the page's own fence
// (check-paste-configs holds the two together). It ends AT Submit, since
// `finishAddTrack` dismisses the widget itself.
function addGraphTrackSteps(json: string): VideoStep[] {
  const conf = JSON.parse(json) as {
    name: string
    assemblyNames: string[]
    adapter: { uri: string; assemblyNameToPanSN?: Record<string, string> }
  }
  const sample = conf.adapter.assemblyNameToPanSN?.[conf.assemblyNames[0]!]
  return [
    {
      type: 'click',
      text: 'File',
      say: 'Load the graph by URL from File, Open track',
      hold: 700,
    },
    { type: 'waitForText', text: 'Open track...' },
    { type: 'click', text: 'Open track...' },
    { type: 'waitForText', text: 'Enter track data' },
    // the workflow select, by the option it is showing
    {
      type: 'click',
      text: 'Add a track from file or URL',
      hold: 700,
    },
    { type: 'waitForText', text: GRAPH_WORKFLOW },
    { type: 'click', text: GRAPH_WORKFLOW },
    { type: 'waitForSelector', selector: URL_INPUT },
    {
      type: 'type',
      selector: URL_INPUT,
      value: `${conf.adapter.uri}.segs.bed.gz`,
    },
    ...(sample
      ? [{ type: 'type', selector: SAMPLE_INPUT, value: sample } as VideoStep]
      : []),
    {
      type: 'type',
      selector: TRACK_NAME_INPUT,
      value: conf.name,
      clear: true,
    },
    { type: 'delay', ms: 2000 },
    { type: 'click', text: 'Submit' },
  ]
}

// A pasted config with no `displayId` gets `<trackId>-<displayType>`.
const K12_GENES_READY = displayReady('K12_genes-LinearBasicDisplay')

export const pangenomeVideos: VideoSpec[] = [
  {
    name: 'pangenome/pggb_subgraph_launch',
    description:
      "A pggb graph from a K12 session that has none of it: add the page's track through the graph form, which opens as the graph of the window, then select the IS5 element on the scale bar and zoom to it, where the graph cuts again",
    goal: 'Load a pggb graph into a K12 session and read it at IS5',
    url: pggbTourStart,
    // the graph form ends ~745px down the drawer, and the app stands at 621
    viewportHeight: 780,
    readySelector: K12_GENES_READY,
    readyTimeout: 120000,
    steps: [
      ...addGraphTrackSteps(PGGB_SEGMENTS_TRACK_JSON),
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 2600,
        say: 'The graph draws under the genes, cut from the window on screen',
      },
      ...zoomToSteps(
        locusWindow,
        'Select the IS5 element on the scale bar and zoom to it',
      ),
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 120000,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'At IS5 the graph re-cuts: strains without the element take the arc past it',
      },
    ],
    tailMs: 2500,
  },
  // Filmed on the IS1 element past flhD, the page's own graph figure's locus. A
  // Minigraph-Cactus graph caps a segment at 1024 bp, so the private stretch
  // arrives as one node where a pggb cut of the same event draws a chain.
  {
    name: 'pangenome_cactus/subgraph_launch',
    description:
      "The Minigraph-Cactus graph into an empty K12 session: add the page's track through the graph form, which opens as the graph of the window, then select the IS1 element past flhD on the scale bar and zoom to it, where the graph cuts again",
    goal: 'Load a Minigraph-Cactus graph into K12 and read it at IS1',
    url: cactusTourStart,
    // the graph form ends ~745px down the drawer, and the app stands at 621
    viewportHeight: 780,
    readySelector: K12_GENES_READY,
    readyTimeout: 120000,
    steps: [
      ...addGraphTrackSteps(cactusVideoFixtures.segmentsTrackJson),
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 2600,
        say: 'The graph draws under the genes, cut from the window on screen',
      },
      ...zoomToSteps(
        cactusVideoFixtures.locusWindow,
        'Select the IS1 element past flhD and zoom to it',
      ),
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 120000,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 3000,
        say: 'At IS1 the graph re-cuts: the element is one node the other strains skip',
      },
    ],
    tailMs: 2500,
  },
  // The node menu is flat — `Node details`, then one `Open in <assembly>` row
  // per assembly the session carries — which is what a reader hunting for a
  // Launch submenu misses.
  {
    name: 'pangenome/pggb_out_to_strain',
    description:
      "A CFT073 allele opened on CFT073's own coordinates, under the K12 genes it bypasses: right-click the node in the graph track, take its Open in entry, and read the deletion from the donor's side",
    goal: 'Open a graph allele on the strain that carries it',
    url: PGGB_STRAIN_LAUNCH,
    // the run measured the three views at 1160; the rest is the caption's strip
    viewportHeight: 1290,
    readySelector: GRAPH_DRAWN,
    readyTimeout: 120000,
    steps: [
      {
        type: 'rightclick',
        anchor: { view: 1, graphNode: PGGB_STRAIN_NODE },
        say: 'Right-click the CFT073 allele and open it on CFT073',
        hold: 900,
      },
      { type: 'waitForText', text: 'Open in CFT073' },
      { type: 'click', text: 'Open in CFT073' },
      {
        type: 'waitForText',
        text: 'CFT073 genes',
        timeout: 120000,
        cut: true,
      },
      {
        type: 'delay',
        ms: 3000,
        say: 'On CFT073, ssuE runs into pyrD: the genes K-12 has between them are gone',
      },
    ],
    tailMs: 3500,
  },
  // The heaviest thing filmed here: 464 rows through an RPC, hence the long
  // timeouts and the cut. The filter is already on the lane.
  {
    name: 'pangenome/hprc_cluster_callset',
    description:
      "HPRC's 464 haplotypes clustered by genotype from the track menu, so the haplotypes sharing structural alleles gather into blocks",
    goal: 'Cluster 464 haplotypes so the ones sharing alleles sit together',
    url: hprcClusterFixtures.session,
    // the dendrogram draws beside the rows, so the app holds at 765px, with the
    // caption chip's strip under it
    viewportHeight: 880,
    readySelector: hprcClusterFixtures.ready,
    readyTimeout: 360000,
    steps: [
      {
        type: 'click',
        selector: trackMenu(hprcClusterFixtures.trackId),
        say: 'Cluster the haplotypes by genotype from the track menu',
        hold: 700,
      },
      ...menuCascade(['Clustering', 'Cluster rows by genotype...']),
      {
        type: 'click',
        text: 'Cluster rows by genotype...',
      },
      { type: 'waitForText', text: 'Run clustering' },
      { type: 'delay', ms: 1500 },
      { type: 'click', text: 'Run clustering' },
      // the dendrogram, not the dialog closing, says the reorder landed
      {
        type: 'waitForSelector',
        selector: hprcClusterFixtures.clustered,
        timeout: 360000,
        cut: true,
      },
      {
        type: 'delay',
        ms: 3500,
        say: 'Haplotypes sharing alleles now gather into blocks',
      },
    ],
    tailMs: 4000,
  },
]
