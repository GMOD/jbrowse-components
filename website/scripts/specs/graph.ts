import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the pangenome tutorials that use the third-party
// jbrowse-plugin-graphgenomeview (GraphGenomeView). The plugin bundle and the
// GFA fixtures are served same-origin from test_data/graphgenomeview, so the
// cross-origin plugin-trust dialog never triggers in the headless capture. The
// GFA slice is the same four-strain E. coli minigraph data the pangenome_ecoli
// tutorial builds its rGFA graph figures from.
//
// The anchored (rGFA) layout is computed locally from the SR:i:0 rank tags and
// is deterministic. The force-directed (Bandage FMMM) layout renders through the
// same pipeline — the worker resolves its WASM engine from the plugin's own
// bundle url — but is nondeterministic (~3% run-to-run drift from the OGDF force
// simulation), so its spec carries a raised diffThreshold: the committed PNG is
// only rewritten when a regen drifts past that, not on every ordinary jitter.

// Ready when the layout has landed (graph-perf-stats) AND the toolbar has
// painted. Waiting on the stats alone raced: a slow subgraph fetch could leave
// the Layout/Color selects unpainted in the captured frame, silently committing
// a figure with half a toolbar. `body:has(A) B` is an AND; a bare `A, B` list
// would be a CSS OR and fire on whichever landed first.
const TOOLBAR_READY =
  'body:has([data-testid="graph-perf-stats"]) [data-testid="graph-layout-select"]'

const CONFIG = 'test_data/graphgenomeview/config.json'
const DATA = 'https://jbrowse.org/demos/ecoli_pangenome'
const ECOLI_SEGMENTS_TRACK = 'ecoli_minigraph_segments'

// Paint the linear segments track in the graph view's own 'Stable rank (rGFA)'
// colors, so the blocks above and the nodes below are the same color for the same
// segment instead of gold-vs-blue. RgfaTabixAdapter puts the SR tag on the
// feature as `rank`, and the plugin's scheme is rank 0 -> rgb(52,152,219), then a
// ramp from rgb(237,137,44) at rank 1 to rgb(158,42,122) at the subgraph's max
// rank. Only rank 0 has reference coordinates, so a reference LGV only ever draws
// the blue backbone; the else branch is the ramp's rank-1 end, for a linear view
// opened on one of the other assemblies.
const RANK_COLOR_DEFAULTS = {
  color: "jexl:get(feature,'rank')==0?'rgb(52,152,219)':'rgb(237,137,44)'",
}

// The HPRC figures take the other route into the same view: instead of a whole
// GFA file, a GraphGenomeView carrying `loadedTrackId`/`loadedRegion` — the exact
// snapshot the "Launch view, then Graph genome view (this region)" menu item
// writes, so the figure documents the launch route rather than a second way in.
// The view cuts its subgraph from the track's own tabix indexes on attach.
const HPRC_CONFIG = 'test_data/graphgenomeview/hprc.json'
const SEGMENTS_TRACK = 'hprc_minigraph_segments'
const MHC_REGION = {
  refName: 'chr6',
  assemblyName: 'hg38',
  start: 32500000,
  end: 32560000,
}

export const graphSpecs: ScreenshotSpec[] = [
  // The pggb subgraph: a plain GFA, so it has no rank tags to anchor to and the
  // force engine is the only layout that can draw it (layoutMode 'auto' falls
  // through to FMMM on its own). Colored by depth, how many of the four strains
  // traverse each node. The FMMM run drifts ~3% between runs, so diffThreshold
  // is raised well above it to keep the committed PNG stable across regens.
  {
    mode: 'url',
    name: 'pangenome/local_subgraph',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'GraphGenomeView',
          gfaLocation: { uri: `${DATA}/ecoli_pggb_subgraph.gfa` },
          colorScheme: 'depth',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 60000,
    allowUnsettled: true,
    settleMs: 8000,
    diffThreshold: 0.1,
    viewportWidth: 1000,
    viewportHeight: 760,
    hideTooltip: true,
  },
  // The indexed route on the tutorial's own four-strain graph: the rGFA
  // segments as a feature track over a 50 kb K12 window, and the subgraph the
  // launch menu cuts from that same window below it. Same two tabix indexes
  // feed both, so the segment ids above are the nodes below. The track is
  // declared in the session rather than the config because the config is the
  // shared graphgenomeview fixture; the indexes are hosted beside the GFAs.
  {
    mode: 'url',
    name: 'pangenome/rgfa_subgraph_launch',
    url: sessionSpec(CONFIG, {
      sessionTracks: [
        {
          type: 'FeatureTrack',
          trackId: ECOLI_SEGMENTS_TRACK,
          name: 'minigraph graph segments (rGFA)',
          assemblyNames: ['K12'],
          adapter: {
            type: 'RgfaTabixAdapter',
            uri: `${DATA}/ecoli_minigraph`,
          },
          displayDefaults: RANK_COLOR_DEFAULTS,
        },
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:4,050,000-4,100,000',
          tracks: [ECOLI_SEGMENTS_TRACK],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: ECOLI_SEGMENTS_TRACK,
          loadedRegion: {
            refName: 'chr',
            assemblyName: 'K12',
            start: 4050000,
            end: 4100000,
          },
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    settleMs: 4000,
    viewportWidth: 1000,
    // GraphGenomeView takes no `height` through the launch snapshot, and its
    // auto-fit places a wide-and-flat anchored layout low in the panel, so the
    // frame has to be tall enough to reach it
    viewportHeight: 900,
    hideTooltip: true,
  },
  // The same window in the force layout, the Bandage picture the graph is really
  // about: the backbone winds through the frame and every loop off it is an
  // alternate allele from the 464 haplotypes. FMMM again, hence diffThreshold.
  {
    mode: 'url',
    name: 'pangenome/hprc_mhc_bandage',
    url: sessionSpec(HPRC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr6:32,500,000-32,560,000',
          tracks: [
            'hg38_ncbiRefSeq_ucsc',
            'hprc_minigraph_bubbles',
            SEGMENTS_TRACK,
          ],
        },
        {
          type: 'GraphGenomeView',
          loadedTrackId: SEGMENTS_TRACK,
          loadedRegion: MHC_REGION,
          layoutMode: 'force',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: TOOLBAR_READY,
    readyTimeout: 90000,
    allowUnsettled: true,
    settleMs: 8000,
    diffThreshold: 0.1,
    viewportWidth: 1000,
    viewportHeight: 1300,
    hideTooltip: true,
  },
]
