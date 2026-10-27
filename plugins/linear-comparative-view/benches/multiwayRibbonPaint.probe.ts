/* eslint-disable no-console */
// What does painting the multi-way ribbons cost per zoom step?
//
//   pnpm exec esbuild --bundle --platform=node --format=esm --target=node22 \
//     --outfile=/tmp/ribbonpaint.mjs \
//     plugins/linear-comparative-view/benches/multiwayRibbonPaint.probe.ts
//   node /tmp/ribbonpaint.mjs
//
// Times `buildRibbonGeometry`, the minimum of nine runs, on the tutorial
// session's blocks (grape chr11 around 11:822,000 at 1588 px) at three zooms,
// under four paints: none, strand, a numeric column with an opacity fade, and
// a text column with a has-a-value filter. Each block gets a `ks` number and a
// `grp` label, one in three `NA`, the way a PAF tag arrives as text.
//
// 2026-10-26, before and after the ribbons painted through synteny-core's
// color, opacity and filter functions, on AC, three alternating runs each: at
// the whole chromosome (660 groups) none 1.24 -> 1.26 ms, strand 1.29 -> 1.31,
// ks + fade 2.22 -> 2.41, grp + filter 1.46 -> 1.86; at 1 Mb (112 groups) the
// attribute paints went 0.50 -> 0.59 and 0.33 -> 0.43. The added cost is one
// parse of every placed record per rebuild, the worker's, where the ribbons
// had parsed only the records a drawn pair reached.
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom, toArray } from 'rxjs'

import blocksSchema from '../../comparative-adapters/src/MCScanBlocksAdapter/configSchema.ts'
import {
  decideLaneFrames,
  frameFromDecision,
} from '../src/MultiWaySyntenyDisplay/laneDecision.ts'
import {
  buildLanes,
  laneGeometry,
} from '../src/MultiWaySyntenyDisplay/laneStack.ts'
import {
  groupFeatures,
  laneOpeningsOf,
  rowAssembliesOf,
} from '../src/MultiWaySyntenyDisplay/layoutMultiWay.ts'
import { buildRibbonGeometry } from '../src/MultiWaySyntenyDisplay/multiwayGeometry.ts'

import type { LaneDecision } from '../src/MultiWaySyntenyDisplay/laneDecision.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

class Adapters extends Plugin {
  name = 'Adapters'
  install(pm: PluginManager) {
    pm.addAdapterType(
      () =>
        new AdapterType({
          name: 'MCScanBlocksAdapter',
          configSchema: blocksSchema,
          getAdapterClass: () =>
            import('../../comparative-adapters/src/MCScanBlocksAdapter/MCScanBlocksAdapter.ts').then(
              r => r.default,
            ),
        }),
    )
  }
}
const pm = new PluginManager([new Adapters()])
pm.createPluggableElements()
pm.configure()

const BASE = 'https://jbrowse.org/demos/grape_peach_cacao'
const uri = (name: string) => ({
  uri: `${BASE}/${name}`,
  locationType: 'UriLocation' as const,
})
const ASSEMBLIES = [
  'grape',
  'peach',
  'cacao',
  'arabidopsis',
  'poplar',
  'tomato',
  'citrus',
]
const config = {
  type: 'MCScanBlocksAdapter',
  mcscanBlocksLocation: uri('grape.blocks.gz'),
  blockAssemblies: ASSEMBLIES,
  bedLocations: ASSEMBLIES.map(a => uri(`${a}.bed.gz`)),
  assemblyNames: ASSEMBLIES,
}
const ANCHOR_REF = 'NC_081815.1'
const ANCHOR = 'grape'
const WIDTH = 1588
const HEIGHT = 340
const CENTER = 822_000

async function aliases(a: string) {
  const text = await (await fetch(`${BASE}/${a}.aliases.txt`)).text()
  const map = new Map<string, string>()
  for (const line of text.split('\n')) {
    const cols = line.split('\t').filter(Boolean)
    for (const c of cols) {
      map.set(c, cols[0]!)
    }
  }
  return (r: string) => map.get(r) ?? r
}
const canonOf = new Map<string, (r: string) => string>()
for (const a of ['grape', 'peach', 'cacao']) {
  canonOf.set(a, await aliases(a))
}

const { dataAdapter } = await getAdapter(pm, JSON.stringify(config), config)
const fetched = await firstValueFrom(
  (dataAdapter as BaseFeatureDataAdapter)
    .getFeatures({
      refName: ANCHOR_REF,
      start: 0,
      end: 30_000_000,
      assemblyName: ANCHOR,
    })
    .pipe(toArray()),
)
const GROUPS = ['core', 'shell', 'NA']
const all = fetched.map(
  (f, i) =>
    new SimpleFeature({
      ...f.toJSON(),
      ks: `${((i * 37) % 100) / 100}`,
      grp: GROUPS[i % 3],
    }),
)
const groups = groupFeatures(all)
const rows = rowAssembliesOf(groups, [
  'peach',
  'cacao',
  'poplar',
  'citrus',
  'arabidopsis',
  'tomato',
]).filter(a => a !== ANCHOR)
const attributeRanges = {
  ks: { min: 0, max: 0.99 },
  grp: { labels: ['core', 'shell'], colors: {}, missing: true },
}
const PAINTS = {
  none: { ribbonColor: 'rgb(130,130,130)' },
  strand: { ribbonColorField: 'strand' },
  'ks + fade': {
    ribbonColorField: 'ks',
    opacity: { field: 'ks', scale: { range: ['0.1', '0.6'] } },
  },
  'grp + filter': {
    ribbonColorField: 'grp',
    filter: [{ field: 'grp', valid: true }],
  },
}

function ms(f: () => void) {
  const t = performance.now()
  f()
  return performance.now() - t
}
const minOf = (f: () => void) =>
  Math.min(...Array.from({ length: 9 }, () => ms(f)))

const openingsOf = laneOpeningsOf(groups)
for (const span of [88_000, 1_000_000, 19_500_000]) {
  const start = CENTER - span / 2
  const end = CENTER + span / 2
  const visible = groups.filter(
    g =>
      g.anchor.refName === ANCHOR_REF &&
      g.anchor.end > start &&
      g.anchor.start < end,
  )
  const pxOf = (bp: number) => ((bp - start) / span) * WIDTH
  const decided: Map<string, LaneDecision | undefined> = decideLaneFrames({
    groups: visible,
    openingsOf,
    assemblyNames: rows,
    anchorX: new Map(
      visible.map(g => [g.key, pxOf((g.anchor.start + g.anchor.end) / 2)]),
    ),
    anchorCoordOf: g => ({
      refName: g.anchor.refName,
      coord: (g.anchor.start + g.anchor.end) / 2,
    }),
    pxOfAnchor: c => pxOf(c.coord),
    unitBp: span,
    width: WIDTH,
    previous: new Map(),
  })
  const stack = buildLanes({
    assemblyNames: [ANCHOR, ...rows],
    groups: visible,
    anchorSpans: new Map(
      visible.map(g => [
        g.key,
        [pxOf(g.anchor.start), pxOf(g.anchor.end)] as const,
      ]),
    ),
    rowFrames: new Map(
      rows.map(a => {
        const d = decided.get(a)
        return [
          a,
          d && frameFromDecision(d, pxOf(d.pivotAnchor.coord), span, WIDTH),
        ]
      }),
    ),
    axisSpanOf: (_r, s, e) => [pxOf(s), pxOf(e)],
    axisSpansOf: (_r, s, e) => [[pxOf(s), pxOf(e)]],
    anchorRegionSpans: [[0, WIDTH]],
    anchorBpPerPx: 1,
    contigOf: () => undefined,
    refNameAliasOf: a => canonOf.get(a),
    width: WIDTH,
    geometry: laneGeometry(HEIGHT, 1 + rows.length),
  })
  const times = Object.entries(PAINTS).map(([name, paint]) => {
    const t = minOf(() => {
      buildRibbonGeometry({
        stack,
        laneLinks: undefined,
        ribbonColor: 'rgb(130,130,130)',
        attributeRanges,
        drawCurves: false,
        ...paint,
      })
    })
    return `${name} ${t.toFixed(2)}`
  })
  console.log(
    `span ${Math.round(span / 1000)}kb, ${visible.length} groups: ${times.join(' | ')}`,
  )
}
