/* eslint-disable no-console */
// Where does a zoom step's cell packing go in the multi-way synteny track?
//
//   pnpm exec esbuild --bundle --platform=node --format=esm --target=node22 \
//     --outfile=/tmp/zoomcost.mjs \
//     plugins/linear-comparative-view/benches/multiwayZoomCost.probe.ts
//   node /tmp/zoomcost.mjs
//
// Times the pure builders the display's getters call — the lane decision, the
// lane stack, the ribbon, tick, band and glyph cells — on the tutorial
// session's own data (grape chr11 around 11:822,000 at 1588 px), over twelve
// zoom-out steps of 1.35x. The genes are re-wrapped as SimpleFeature the way
// the RPC hands them to the main thread, so an attribute read costs what it
// costs there. Network time is excluded and every builder is the minimum of
// five runs; the bracketed glyph split re-times its pieces on their own, with
// `shape` the uncached walk `LaneGene` now runs once per feature.
//
// 2026-08-27, before and after `LaneGene` cached the shape: at 1430 on-canvas
// genes the glyph cells went 23 ms -> 11 ms and the px projection 12.8 -> 1.9.
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { AdapterType } from '@jbrowse/core/pluggableElementTypes'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom, toArray } from 'rxjs'

import blocksSchema from '../../comparative-adapters/src/MCScanBlocksAdapter/configSchema.ts'
import gffSchema from '../../gff3/src/Gff3TabixAdapter/configSchema.ts'
import { configSchemaFactory } from '../src/MultiWaySyntenyDisplay/configSchema.ts'
import {
  geneGlyphGeometry,
  geneGlyphShape,
  laneGeneFeatures,
} from '../src/MultiWaySyntenyDisplay/geneGlyph.ts'
import {
  decideLaneFrames,
  frameFromDecision,
} from '../src/MultiWaySyntenyDisplay/laneDecision.ts'
import { buildLanes } from '../src/MultiWaySyntenyDisplay/laneStack.ts'
import {
  groupFeatures,
  laneFetchRegion,
  rowAssembliesOf,
  tickIntervalFor,
} from '../src/MultiWaySyntenyDisplay/layoutMultiWay.ts'
import {
  buildBandCell,
  buildLaneCells,
  buildRibbonGeometry,
  buildTickGeometry,
} from '../src/MultiWaySyntenyDisplay/multiwayGeometry.ts'

import type { LaneGene } from '../src/MultiWaySyntenyDisplay/geneGlyph.ts'
import type { LaneDecision } from '../src/MultiWaySyntenyDisplay/laneDecision.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

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
    pm.addAdapterType(
      () =>
        new AdapterType({
          name: 'Gff3TabixAdapter',
          configSchema: gffSchema,
          getAdapterClass: () =>
            import('../../gff3/src/Gff3TabixAdapter/Gff3TabixAdapter.ts').then(
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
const blocksConfig = {
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

async function features(config: Record<string, unknown>, region: any) {
  const { dataAdapter } = await getAdapter(pm, JSON.stringify(config), config)
  return firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter).getFeatures(region).pipe(toArray()),
  )
}

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
const geneAdapters = new Map<string, Record<string, unknown>>(
  ['grape', 'peach', 'cacao'].map(a => [
    a,
    {
      type: 'Gff3TabixAdapter',
      gffGzLocation: uri(`${a}.genes.gff3.gz`),
      index: { location: uri(`${a}.genes.gff3.gz.tbi`) },
    },
  ]),
)

const all = await features(blocksConfig, {
  refName: ANCHOR_REF,
  start: 0,
  end: 30_000_000,
  assemblyName: ANCHOR,
})
const groups = groupFeatures(all)
const rows = rowAssembliesOf(
  groups,
  ['peach', 'cacao', 'poplar', 'citrus', 'arabidopsis', 'tomato'],
  (a, b) => a === b,
).filter(a => a !== ANCHOR)
console.log(`${all.length} features, ${groups.length} groups, lanes ${rows}`)

const config = configSchemaFactory().create({
  type: 'MultiWaySyntenyDisplay',
  displayId: 'probe',
})

function ms(f: () => void) {
  const t = performance.now()
  f()
  return performance.now() - t
}

let previous = new Map<string, LaneDecision | undefined>()
let span = 88_000
const geneCache = new Map<string, LaneGene[]>()
for (let step = 0; step < 12; step++, span *= 1.35) {
  const start = CENTER - span / 2
  const end = CENTER + span / 2
  const visible = groups.filter(
    g =>
      g.anchor.refName === ANCHOR_REF &&
      g.anchor.end > start &&
      g.anchor.start < end,
  )
  const pxOf = (bp: number) => ((bp - start) / span) * WIDTH
  const anchorX = new Map(
    visible.map(g => [g.key, pxOf((g.anchor.start + g.anchor.end) / 2)]),
  )
  const tDecide = ms(() => {
    previous = decideLaneFrames({
      groups: visible,
      assemblyNames: rows,
      anchorX,
      anchorCoordOf: g => ({
        refName: g.anchor.refName,
        coord: (g.anchor.start + g.anchor.end) / 2,
      }),
      pxOfAnchor: c => pxOf(c.coord),
      unitBp: span,
      width: WIDTH,
      previous,
    })
  })
  const rowFrames = new Map(
    rows.map(a => {
      const d = previous.get(a)
      return [
        a,
        d && frameFromDecision(d, pxOf(d.pivotAnchor.coord), span, WIDTH),
      ]
    }),
  )
  const anchorSpans = new Map(
    visible.map(g => [
      g.key,
      [pxOf(g.anchor.start), pxOf(g.anchor.end)] as const,
    ]),
  )
  // lane genes, network untimed
  const laneGenes = new Map<string, LaneGene[]>()
  for (const [a, adapter] of geneAdapters) {
    const region =
      a === ANCHOR
        ? {
            refName: ANCHOR_REF,
            start: Math.max(0, start - span),
            end: end + span,
          }
        : rowFrames.get(a) && laneFetchRegion(rowFrames.get(a)!)
    if (!region) {
      continue
    }
    const refName = canonOf.get(a)!(region.refName)
    const key = `${a}:${refName}:${region.start}-${region.end}`
    let genes = geneCache.get(key)
    if (!genes) {
      genes = laneGeneFeatures(
        (await features(adapter, { ...region, refName, assemblyName: a })).map(
          f => new SimpleFeature(f.toJSON()),
        ),
      )
      geneCache.set(key, genes)
    }
    laneGenes.set(a, genes)
  }

  let stack!: ReturnType<typeof buildLanes>
  const tLanes = ms(() => {
    stack = buildLanes({
      assemblyNames: [ANCHOR, ...rows],
      groups: visible,
      anchorSpans,
      rowFrames,
      laneGenes,
      laneGeneAdapters: geneAdapters,
      axisSpanOf: (_r, s, e) => [pxOf(s), pxOf(e)],
      refNameAliasOf: a => canonOf.get(a),
      width: WIDTH,
      height: HEIGHT,
    })
  })
  const tRibbons = ms(() => {
    buildRibbonGeometry({
      stack,
      laneLinks: undefined,
      ribbonColor: 'rgba(130,130,130,0.3)',
      drawCurves: false,
      bridgeSkippedLanes: true,
    })
  })
  const tTicks = ms(() => {
    buildTickGeometry({
      stack,
      tickIntervalBp: tickIntervalFor(span),
      width: WIDTH,
      color: '#eee',
    })
  })
  const tBands = ms(() => {
    buildBandCell({
      bands: stack.lanes,
      width: WIDTH,
      paper: '#fff',
      stripe: '#eee',
    })
  })
  const colorOf = (slot: 'color' | 'utrColor', feature: Feature) =>
    readConfObject(config, slot, { feature })
  const minOf = (f: () => void) => Math.min(...[0, 1, 2, 3, 4].map(() => ms(f)))
  let geneCount = 0
  let onCanvasCount = 0
  const tGlyphs = minOf(() => {
    for (const lane of stack.lanes) {
      buildLaneCells({
        lane,
        glyphHeight: stack.glyphHeight,
        width: WIDTH,
        colors: { colorOf, stroke: '#000', divider: '#ccc' },
      })
    }
  })
  const spans: {
    lane: (typeof stack.lanes)[0]
    gene: LaneGene
    span: readonly [number, number]
  }[] = []
  const tSpan = minOf(() => {
    spans.length = 0
    geneCount = 0
    for (const lane of stack.lanes) {
      for (const gene of lane.genes) {
        geneCount++
        const span = lane.spanOf(
          gene.feature.get('refName'),
          gene.feature.get('start'),
          gene.feature.get('end'),
        )
        if (
          span &&
          Math.max(span[0], span[1]) >= -WIDTH / 2 &&
          Math.min(span[0], span[1]) <= 1.5 * WIDTH
        ) {
          spans.push({ lane, gene, span })
        }
      }
    }
  })
  onCanvasCount = spans.length
  const tShape = minOf(() => {
    for (const { gene } of spans) {
      geneGlyphShape(gene.feature)
    }
  })
  const tGeom = minOf(() => {
    for (const { lane, gene, span } of spans) {
      const refName = gene.feature.get('refName')
      geneGlyphGeometry(gene, span, (s, e) => lane.spanOf(refName, s, e))
    }
  })
  const tColor = minOf(() => {
    for (const { gene } of spans) {
      colorOf('color', gene.feature)
      colorOf('utrColor', gene.feature)
    }
  })
  console.log(
    `span ${Math.round(span / 1000)}kb groups ${visible.length} genes ${geneCount}: decide ${tDecide.toFixed(2)} lanes ${tLanes.toFixed(2)} ribbons ${tRibbons.toFixed(2)} ticks ${tTicks.toFixed(2)} bands ${tBands.toFixed(2)} glyphs ${tGlyphs.toFixed(2)} [onCanvas ${onCanvasCount}: spanOf ${tSpan.toFixed(2)} shape ${tShape.toFixed(2)} geom ${tGeom.toFixed(2)} color ${tColor.toFixed(2)}]`,
  )
}
