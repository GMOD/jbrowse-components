// `local` has to live in one module: at module scope it writes the
// `*_local.json` siblings and copies the plugin's dist.
import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { pluginCheckout, repoRoot } from '../paths.ts'
import { menuCascade, trackMenuIcon } from '../screenshot-spec-helpers.ts'
import { ECOLI_DEMO_BASE, usingLocalDemo } from './demoBase.ts'

import type { ScreenshotAction } from '../screenshot-spec-types.ts'

const HOSTED_DEMO = 'https://jbrowse.org/demos/ecoli_pangenome'

// Every fixture names the plugin's unversioned npm url, so a plugin publish
// moves these figures at the next regen. Regenerate unfiltered after one:
// `--filter` implies `--force`, which skips the 0.5% gate and churns them all.

// Across a re-cut the old graph keeps its node count until `data-loading`
// clears.
export const GRAPH_DRAWN =
  '[data-testid="linear-graph-display"][data-node-count]:not([data-loading])'

export const graphCutDrawn = (tier: 'fine' | 'coarse') =>
  `[data-testid="linear-graph-display"][data-cut-tier="${tier}"][data-node-count]:not([data-loading])`

export const graphTrack = (trackId: string, props: Record<string, unknown>) => {
  const { paneHeight, ...rest } = props
  return {
    trackId,
    type: 'LinearGraphDisplay',
    ...rest,
    ...(paneHeight === undefined ? {} : { height: paneHeight }),
  }
}

// Never under the window's own span, which the track refuses to cut at all.
export function cutNear(window: number | { start: number; end: number }) {
  const span = typeof window === 'number' ? window : window.end - window.start
  return Math.ceil(span * 1.1)
}

// A radio or checkbox row leaves its menu open; follow with `closeMenusAfter`.
export function graphTrackMenu(
  trackId: string,
  path: string[],
): ScreenshotAction[] {
  const row = path.at(-1)!.toLowerCase().replaceAll(/\s+/g, '_')
  return [
    trackMenuIcon(trackId),
    ...menuCascade(path),
    { type: 'click', selector: `[data-testid="cascading-menuitem-${row}"]` },
  ]
}

// `body:has(A) B` is an AND, so the gate also waits for the toolbar.
export const GRAPH_VIEW_DRAWN =
  '[data-view-phase="ready"] [data-testid="graph-stats"]'
export const GRAPH_VIEW_READY = `body:has(${GRAPH_VIEW_DRAWN}) [data-testid="graph-layout-select"]`

// GRAPH_PLUGIN_LOCAL=1 repoints the fixtures at a local plugin build through
// gitignored `*_local.json` siblings. Switch back before committing figures.
const localEsmUrl =
  '/test_data/graphgenomeview/_localdist/jbrowse-plugin-graphgenomeviewer.esm.js'

// The copy runs every time, since a stale hand-kept `_localdist` hides fixes.
if (process.env.GRAPH_PLUGIN_LOCAL) {
  const pluginDist =
    process.env.GRAPH_PLUGIN_DIST ??
    join(pluginCheckout('graphgenomeviewer'), 'dist')
  if (!existsSync(pluginDist)) {
    throw new Error(
      `GRAPH_PLUGIN_LOCAL is set but no plugin build at ${pluginDist} — run \`pnpm build\` in the plugin, or set GRAPH_PLUGIN_DIST`,
    )
  }
  const dest = join(repoRoot, 'test_data/graphgenomeview/_localdist')
  rmSync(dest, { force: true, recursive: true })
  cpSync(pluginDist, dest, { recursive: true })
}
// ECOLI_DEMO_BASE rewrites the fixtures' hosted data urls too.
const rewriteFixture = usingLocalDemo || process.env.GRAPH_PLUGIN_LOCAL
export const local = rewriteFixture
  ? (name: string) => {
      const derived = name.replace(/\.json$/, '_local.json')
      let text = readFileSync(join(repoRoot, name), 'utf8')
      if (usingLocalDemo) {
        text = text.replaceAll(HOSTED_DEMO, ECOLI_DEMO_BASE)
      }
      const config = JSON.parse(text) as { plugins: { esmUrl: string }[] }
      if (process.env.GRAPH_PLUGIN_LOCAL) {
        for (const plugin of config.plugins) {
          plugin.esmUrl = localEsmUrl
        }
      }
      writeFileSync(
        join(repoRoot, derived),
        `${JSON.stringify(config, null, 2)}\n`,
      )
      return derived
    }
  : (name: string) => name

// REFERENCE_RAMP_ALT_COLOR in the plugin's GeometryBuilder.
export const ALT_ALLELE_COLOR = 'rgb(60,65,72)'

// Shared so the pggb and Minigraph-Cactus pages answer in the same colors. An
// rGFA has no `SM:Z:` tag, so its segments paint the no-value grey.
export const STRAINS_PER_SEGMENT_DISPLAY = {
  color: {
    field: 'sampleCount',
    domain: ['5', '4', '3', '2', '1'],
    range: ['#bdbdbd', '#fed976', '#feb24c', '#fd8d3c', '#e31a1c'],
    labels: [
      'All 5 strains (core)',
      '4 strains',
      '3 strains',
      '2 strains',
      '1 strain (private)',
    ],
    title: 'Strains',
  },
}

// The linear half of the graph's 'Reference position' ramp
// (REFERENCE_RAMP_MAX_HUE in the plugin's GeometryBuilder). A bubble tier's
// rank-1 rows draw charcoal by design. The graph ramps over its cut, a window-width wider each side, so
// pass the graph track the same domain as `color.domainMin`/`domainMax`.
export function referencePositionColor({
  start,
  end,
}: {
  start: number
  end: number
}) {
  const mid = "(get(feature,'start')+get(feature,'end'))/2"
  const hue = `min(300, max(0, (${mid} - ${start}) / ${end - start} * 300))`
  return `jexl:get(feature,'rank')>0 ? '${ALT_ALLELE_COLOR}' : 'hsl(' + ${hue} + ',70%,50%)'`
}
