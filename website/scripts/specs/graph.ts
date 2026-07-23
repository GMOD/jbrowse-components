import { sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the pangenome tutorials that use the third-party
// jbrowse-plugin-graphgenomeview (GraphGenomeView). The plugin bundle and the
// GFA fixtures are served same-origin from test_data/graphgenomeview, so the
// cross-origin plugin-trust dialog never triggers in the headless capture. The
// GFA slice is the same four-strain E. coli minigraph data the pangenome_ecoli
// tutorial builds its rGFA graph figures from.
//
// Only the anchored (rGFA) layout is committed: it is computed locally from the
// SR:i:0 rank tags and is deterministic. The force-directed (Bandage FMMM)
// layout also renders through this pipeline — the worker resolves its WASM
// engine from the plugin's own bundle url — but an FMMM layout is
// nondeterministic (~3% run-to-run drift), so it can't be a content-stable
// committed figure and is left to the tutorial's hand-curated force figures.
const CONFIG = 'test_data/graphgenomeview/config.json'
const DATA = 'https://jbrowse.org/demos/ecoli_pangenome'

export const graphSpecs: ScreenshotSpec[] = [
  // The four-strain minigraph (rGFA) slice in the anchored layout, colored by
  // stable rank: the rank-0 K12 backbone runs blue along the x axis at the
  // offsets its segments declare, with higher-rank alternate alleles below it.
  // gfaLocation/colorScheme ride through the session spec onto the view snapshot
  // (LaunchView-GraphGenomeView forwards every field), so one config drives the
  // figure; session-spec locations don't inherit the config baseUri, so the uri
  // is app-origin-relative.
  {
    mode: 'url',
    name: 'pangenome/graph_rgfa',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'GraphGenomeView',
          gfaLocation: { uri: `${DATA}/ecoli_rgfa_slice.gfa` },
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: '[data-testid="graph-genome-canvas"]',
    readyTimeout: 60000,
    settleMs: 4000,
    viewportWidth: 1000,
    viewportHeight: 640,
    hideTooltip: true,
  },
]
