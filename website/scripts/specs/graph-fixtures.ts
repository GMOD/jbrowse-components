// Everything the pangenome graph figures share, whichever organism they draw:
// the fixture configs and the switches that repoint them at a local build, the
// two ready gates, and the reference-position colour ramp.
//
// This was the preamble of specs/graph.ts, which held both organisms in 5,524
// lines and is now specs/graph-ecoli.ts and specs/graph-hprc.ts. Of the 124
// top-level bindings that preamble carried, five are read from both sides, and
// they are here; the seam is that clean because the two datasets share their
// vocabulary and nothing else.
//
// `local` is the one that HAS to be a single module rather than a copy per
// organism. It writes the gitignored `*_local.json` siblings, and the
// GRAPH_PLUGIN_LOCAL block below copies the plugin's dist — both at module
// scope, so a second copy would do that work twice per run. ESM evaluates this
// module once before either importer's body runs, which is what makes that
// safe.
//
// This file exports no spec of its own. screenshot-impact.ts has a rule for
// that (see `specsImporting`): an edit here selects the specs of every sibling
// module that imports it, rather than selecting nothing.
import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import { repoRoot } from '../paths.ts'
import { ECOLI_DEMO_BASE, usingLocalDemo } from './demoBase.ts'

// The url the tracked fixture configs hardcode, and what ECOLI_DEMO_BASE
// replaces in them when it is set.
const HOSTED_DEMO = 'https://jbrowse.org/demos/ecoli_pangenome'

// Figures for the pangenome tutorials that use the third-party
// jbrowse-plugin-graphgenomeview (GraphGenomeView). The plugin bundle and the
// GFA fixtures are served same-origin from test_data/graphgenomeview, so the
// cross-origin plugin-trust dialog never triggers in the headless capture. The
// GFA slice is the same four-strain E. coli minigraph data the pangenome_ecoli
// tutorial builds its rGFA graph figures from.
//
// The anchored (rGFA) layout is computed locally from the SR:i:0 rank tags. The
// force-directed (Bandage FMMM) layout renders through the same pipeline — the
// worker resolves its WASM engine from the plugin's own bundle url. Both are
// deterministic, so no graph spec needs a raised diffThreshold: FMMM seeded its
// initial placement from clock() until the plugin fixed the seed, and the ~2%
// of pixels that moved on every regen was enough to hide a real change (an
// orange recolour shipped as goldenrod in three figures under that threshold).
//
// Every fixture pins `esmUrl` to a content-addressed bundle
// (test_data/graphgenomeview/README.md), so the plugin cannot change these
// figures without a diff in this repo.
//
// Deterministic in PIXELS is not deterministic in BYTES, and a pin bump is
// where that bites. Regenerating this set with `--filter` to check what a new
// bundle moved rewrites all of them, because --filter implies --force and force
// skips the 0.5% gate that normally absorbs the sub-pixel jitter two
// consecutive renders of the same spec produce. The result reads as "the bundle
// moved 25 figures" and is 25 figures of churn in figures.lock. Regenerate
// UNFILTERED after a pin bump and let the gate answer, or accept that the
// answer you get is not about the bundle.

// The graph has drawn: the geometry pass has run and reported its vertex count.
//
// **Not `graph-perf-stats`, which is what every gate here used to say.** Plugin
// `34018b5` put the perf READOUT behind `showPerf`, default off, because a
// machine's fetch time in the toolbar of a published figure is a number the
// reader has to work out is not about them. That took the element out of the DOM
// with it, so the moment the pin moved past that build, every selector below
// became unsatisfiable and eleven graph figures failed to capture at once,
// reading as a spec bug rather than as the bundle.
//
// The counts on `graph-stats` are unconditional by construction — GraphStats.tsx
// says so, and puts them on that element rather than on the readout precisely so
// switching the text off leaves them behind. `data-geometry-vertices` is empty
// until buildGeometry has run, so it is the same signal without the setting.
export const GRAPH_DRAWN =
  '[data-testid="graph-stats"]:not([data-geometry-vertices=""])'

// Ready when the layout has landed AND the toolbar has painted. Waiting on the
// stats alone raced: a slow subgraph fetch could leave the Layout/Color selects
// unpainted in the captured frame, silently committing a figure with half a
// toolbar. `body:has(A) B` is an AND; a bare `A, B` list would be a CSS OR and
// fire on whichever landed first.
export const TOOLBAR_READY = `body:has(${GRAPH_DRAWN}) [data-testid="graph-layout-select"]`

// The tracked fixtures, whose `esmUrl` is the published, content-addressed
// plugin bundle. Their `*_local.json` siblings point that url at a local
// `pnpm build` of the plugin instead and are gitignored, so a spec naming one
// renders here and gives the reader a live link to a config that exists on no
// server (checked by `pnpm check-live-configs`). Iterate against a local plugin
// build by setting GRAPH_PLUGIN_LOCAL=1, and switch back before committing
// figures.
//
// The sibling is WRITTEN here rather than kept by hand, because a gitignored
// copy of a tracked config drifts and nothing notices: `hprc_local.json` was
// made before the two CFHR gene tracks were added to `hprc.json`, so under
// GRAPH_PLUGIN_LOCAL those tracks were simply absent and
// `pangenome/hprc_cfhr_deletion` failed on annotation anchors that resolved to
// nothing. That reads as a regression in whatever you are testing, which is the
// worst possible failure for the one switch you flip only when hunting one.
const localEsmUrl =
  '/test_data/graphgenomeview/_localdist/jbrowse-plugin-graphgenomeviewer.esm.js'

// `_localdist` is COPIED from the plugin's dist/ on every GRAPH_PLUGIN_LOCAL
// run, for the same reason the `_local.json` siblings above are written rather
// than kept: a gitignored copy of something built elsewhere drifts and nothing
// notices. It drifted, and it cost a full day. Every "I rebuilt the plugin and
// the bug is still there" result in that session — across a dependency bump, two
// upstream patches and two rounds of instrumentation — was read off a bundle
// hours old, because this directory was a stale hand-copy. Four conclusions were
// wrong and the real cause went unfound until the staleness was noticed.
//
// Missing dist/ is fatal rather than silently falling back to the pinned bundle:
// a run that quietly tests the published plugin when you asked for the local one
// is the same failure again.
if (process.env.GRAPH_PLUGIN_LOCAL) {
  const pluginDist =
    process.env.GRAPH_PLUGIN_DIST ??
    join(repoRoot, '..', 'jb2plugins', 'jbrowse-plugin-graphgenomeview', 'dist')
  if (!existsSync(pluginDist)) {
    throw new Error(
      `GRAPH_PLUGIN_LOCAL is set but no plugin build at ${pluginDist} — run \`pnpm build\` in the plugin, or set GRAPH_PLUGIN_DIST`,
    )
  }
  const dest = join(repoRoot, 'test_data/graphgenomeview/_localdist')
  rmSync(dest, { force: true, recursive: true })
  cpSync(pluginDist, dest, { recursive: true })
}
// The fixture configs also hardcode the hosted demo's data urls, so ECOLI_DEMO_BASE
// has to rewrite them here too — otherwise a local-demo run renders the new
// plugin against the OLD hosted files. Same gitignored-sibling mechanism, and it
// writes the sibling rather than keeping one by hand for the same reason: a
// hand-kept copy of a tracked config drifts and nothing notices.
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

// What the graph paints an off-reference allele in its 'Reference position'
// scheme (REFERENCE_RAMP_ALT_COLOR in the plugin's GeometryBuilder). Hoisted so
// the linear lane's jexl and the prose below name one color.
export const ALT_ALLELE_COLOR = 'rgb(60,65,72)'

// A segments lane colored by how many of the five strains walk each segment,
// rather than by reference position. The adapter puts the walk's `SM:Z:` tag on
// the feature as `samples` and `carriers`, so this is the graph's own statement
// of membership drawn along the reference instead of read off one clicked node.
//
// Five discrete steps rather than a continuous ramp, because five strains is
// five answers and the legend then names each one. Grey for all five: the core
// backbone is the background these figures are not about, and the private boxes
// have to be what the eye lands on. The last color is a fallback, not a sixth
// step — an rGFA has no tag column, so `carriers` is absent there rather than 0.
//
// Shared because both builders' graphs carry the same five strains and the same
// tag: the pggb figures read it off `ecoli_pggb` and the Minigraph-Cactus one
// off `ecoli_cactus`, and a second copy of the ramp would let the two pages
// answer the same question in different colors.
const CARRIAGE_COLORS = {
  1: '#e31a1c',
  2: '#fd8d3c',
  3: '#feb24c',
  4: '#fed976',
  5: '#bdbdbd',
} as const

export const CARRIAGE_DISPLAY = {
  color: `jexl:${[5, 4, 3, 2]
    .map(n => `feature.carriers==${n}?'${CARRIAGE_COLORS[n as 5]}':`)
    .join('')}feature.carriers==1?'${CARRIAGE_COLORS[1]}':'#eeeeee'`,
  legend: [
    { label: 'All 5 strains (core)', color: CARRIAGE_COLORS[5] },
    { label: '4 strains', color: CARRIAGE_COLORS[4] },
    { label: '3 strains', color: CARRIAGE_COLORS[3] },
    { label: '2 strains', color: CARRIAGE_COLORS[2] },
    { label: '1 strain (private)', color: CARRIAGE_COLORS[1] },
  ],
}

// The linear half of the graph view's 'Reference position' color scheme, which
// is the answer to "if the nodes were rainbow colored in exact same way in
// lineargenomeview and bandage graph it might help show correspondence".
//
// That scheme is a hue ramp over the region the subgraph was cut from: hue 0
// (red) at its start to 300 (magenta) at its end, at saturation 70% and
// lightness 50% (jbrowse-plugin-graphgenomeview renderer/GeometryBuilder.ts,
// REFERENCE_RAMP_MAX_HUE). It is a function of two stated numbers and a
// midpoint, which is the whole reason it exists: a linear track can reproduce
// it exactly, so a block above and a node below are the same color for the same
// bp. Every scheme before it could not — depth and rank are graph quantities,
// and the old rainbow ramped over node index, which a linear view cannot know.
//
// An off-reference segment comes off the ramp entirely and paints one flat
// charcoal, matching REFERENCE_RAMP_ALT_COLOR in the plugin. It used to keep the
// hue of the reference it replaces, paler (45%/72% against 70%/50%); review
// asked for "a non-spectrum coloring" for the non-backbone parts, because a hue
// on the ramp says the allele IS the reference at that position.
//
// WHICH LANES THAT BRANCH ACTUALLY FIRES ON, because the two kinds of index
// differ and the charcoal has been read as a bug on the one where it does
// (review, on pangenome/pggb_bubble_tier: "it is sort of odd to see black
// segments in the linaergenomeview to me, i thought those are all reference"):
//
//  - AN rGFA SEGMENT INDEX over the reference. Never. A rank>0 segment states
//    its coordinates on its own stable sequence, so it is not in this window at
//    all, and the pair of rows a dense lane draws is the layout packing rank-0
//    blocks, not rank. The branch is there for a lane opened on a contributing
//    assembly, where those segments do appear.
//  - A BUBBLE TIER. Every window, by construction: `snarls_to_bubble_bed.py`
//    anchors each bubble at its REFERENCE span, so a tier row alternates rank-0
//    backbone with rank-1 bubbles tiling the same axis. Those are the charcoal
//    blocks, and they are the point of the lane — the bubbles are what the
//    coarse tier keeps. They pack onto their own row because at ~100 bp/px a
//    124 bp bubble is a pixel wide and cannot sit beside its neighbours.
//
// `rank` is what RgfaTabixAdapter puts on the feature; a track carrying none
// reads `undefined > 0` as false and stays on the ramp.
//
// The domain has to be the graph's loadedRegion, not the linear view's window,
// when the two differ.
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
