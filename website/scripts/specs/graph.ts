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
  // The same minigraph slice in the force-directed (Bandage FMMM) layout: the
  // backbone is inferred by the force simulation rather than drawn on the rank
  // axis, so the alternate alleles fall out as bubbles instead of ranked rows.
  // graph-perf-stats appears once the remote FMMM layout returns, so it is the
  // ready signal; the view then auto-fits the settled graph. The FMMM run drifts
  // ~3% between runs, so diffThreshold is raised well above it to keep the
  // committed PNG stable across regens.
  {
    mode: 'url',
    name: 'pangenome/graph_force',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'GraphGenomeView',
          gfaLocation: { uri: `${DATA}/ecoli_rgfa_slice.gfa` },
          layoutMode: 'force',
          colorScheme: 'stable-rank',
        },
      ],
    }),
    readySelector: '[data-testid="graph-perf-stats"]',
    readyTimeout: 60000,
    allowUnsettled: true,
    settleMs: 8000,
    diffThreshold: 0.1,
    viewportWidth: 1000,
    viewportHeight: 640,
    hideTooltip: true,
  },
]
