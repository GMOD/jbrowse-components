// The graph tours, on the pangenome pages: loading a graph and reading it at a
// locus, and the HPRC page's routes.
import { menuCascade, sessionSpec } from '../screenshot-spec-helpers.ts'
import {
  HPRC_PAGE,
  MHC_GRAPH_LINK,
  portalGraphLaunch,
} from '../specs/genomes_pangenome.ts'
import {
  PGGB_SEGMENTS_TRACK_JSON,
  pggbVideoFixtures,
} from '../specs/graph-ecoli.ts'
import { GRAPH_DRAWN } from '../specs/graph-fixtures.ts'
import { hprcClusterFixtures, hprcVideoFixtures } from '../specs/graph-hprc.ts'
import { cactusVideoFixtures } from '../specs/pangenome_cactus.ts'
import { displayReady, LOCATION_BOX, trackMenu, zoomToSteps } from './shared.ts'

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

const {
  haplotype: HAPLOTYPE,
  haplotypeNode: HAPLOTYPE_NODE,
  launchedZoomOutButton: LAUNCHED_ZOOM_OUT,
} = hprcVideoFixtures

const GRAPH_WORKFLOW = 'Add pangenome graph track'
const URL_INPUT = '[data-testid="urlInput"]'
const SAMPLE_INPUT = '[data-testid="graph-sample-input"]'
const TRACK_NAME_INPUT = '[data-testid="graph-track-name-input"]'
const HAPLOTYPE_GENES_LABEL = 'CAT genes (NA20809 haplotype 2, HPRC release 2)'
const WORDMARK = '[aria-label="JBrowse"]'
// GRCh38 carries the MHC's genes on its alt contigs too, so a gene search there
// raises the picker, which lists the primary chromosome's hit first.
const FIRST_SEARCH_HIT = 'tbody tr:first-child button'
const ZOOM_OUT = '[data-testid="zoom_out"]'

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
  // The HPRC page's graph launch is a target="_blank" link, so the tour follows
  // it into the new tab.
  {
    name: 'pangenome/hprc_browse',
    description:
      'HPRC release 2 from its genomes.jbrowse.org page: the HLA / MHC graph launch, the allele under HLA-DRB5 hovered and opened on NA20809 haplotype 2, whose genes there include no HLA-DRB5',
    goal: 'Open the HLA graph from the HPRC page and trace one allele',
    url: HPRC_PAGE,
    noSession: true,
    readyText: 'Whole chromosome',
    readyTimeout: 120000,
    // the app is 1344px once the haplotype's view opens under the graph, and
    // the strip under it is where the captions sit rather than over its genes
    viewportHeight: 1500,
    steps: [
      {
        type: 'hover',
        selector: MHC_GRAPH_LINK,
        say: 'Each locus on the HPRC page opens as a graph',
        hold: 1500,
      },
      { type: 'click', selector: MHC_GRAPH_LINK, opensTab: true },
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 240000,
        cut: true,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 2500,
        say: 'GRCh38 runs along the top row; lower rows are sequence it lacks',
      },
      {
        type: 'hover',
        anchor: { graphNode: HAPLOTYPE_NODE },
        say: 'This allele under HLA-DRB5 came from one haplotype',
        hold: 2500,
      },
      {
        type: 'rightclick',
        anchor: { graphNode: HAPLOTYPE_NODE },
        say: "Open it on that haplotype's own chromosome 6",
        hold: 900,
      },
      { type: 'waitForText', text: `Open in ${HAPLOTYPE}` },
      { type: 'click', text: `Open in ${HAPLOTYPE}` },
      // the hosted app's own track label is the gate, and hovering it brings
      // the new view into frame
      {
        type: 'waitForText',
        text: HAPLOTYPE_GENES_LABEL,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', text: HAPLOTYPE_GENES_LABEL, hold: 0 },
      ...Array.from({ length: 6 }, (): VideoStep => ({
        type: 'click',
        selector: LAUNCHED_ZOOM_OUT,
        hold: 350,
      })),
      { type: 'waitForAppSettled', timeout: 120000, cut: true },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 3500,
        say: 'This haplotype has no HLA-DRB5, the gene the allele sits under in GRCh38',
      },
    ],
    tailMs: 3000,
  },
  // `## The graph moves with the view`, on the session the HPRC page's graph
  // link opens. A gene in the MHC is on GRCh38's alt contigs as well, so the
  // search raises the picker a reader meets too.
  {
    name: 'pangenome/hprc_follow_view',
    description:
      'The HLA / MHC graph session searched to C4A: the chr6 hit taken from the picker, two zoom-outs to take in C4B, and the graph track re-cut at each step to the bubble whose alleles run from 0 to 66 kb',
    goal: 'Search a gene, and the graph track follows the view there',
    url: portalGraphLaunch(),
    readySelector: GRAPH_DRAWN,
    readyTimeout: 240000,
    // 940px of app, and the captions below it rather than over the graph
    viewportHeight: 1100,
    steps: [
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'type',
        selector: LOCATION_BOX,
        value: 'C4A',
        clear: true,
        say: 'Search C4A, one of the two complement C4 genes',
      },
      { type: 'press', key: 'Enter' },
      { type: 'waitForText', text: 'Showing results for' },
      {
        type: 'click',
        selector: FIRST_SEARCH_HIT,
        say: 'GRCh38 also carries C4A on alt contigs; take chr6',
      },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', selector: WORDMARK, hold: 1500 },
      {
        type: 'click',
        selector: ZOOM_OUT,
        say: 'Zoom out to take in C4B, the second copy',
        hold: 400,
      },
      { type: 'click', selector: ZOOM_OUT, hold: 400 },
      { type: 'waitForAppSettled', timeout: 180000, cut: true },
      {
        type: 'waitForSelector',
        selector: GRAPH_DRAWN,
        timeout: 180000,
        cut: true,
      },
      { type: 'hover', selector: WORDMARK, hold: 0 },
      {
        type: 'delay',
        ms: 4000,
        say: 'One bubble: where GRCh38 has a 33 kb C4 module, alleles run 0 to 66 kb',
      },
    ],
    tailMs: 3000,
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
