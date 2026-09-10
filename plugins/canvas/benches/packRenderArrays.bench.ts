// What does canvas's hand-written packer cost, and what share of the worker's
// per-region work is it?
//
//   node plugins/canvas/benches/packRenderArrays.bench.ts
//   node plugins/canvas/benches/packRenderArrays.bench.ts --rounds=9 --genes=20000
//
// A synthetic gene track — one gene, two mRNA isoforms, eight CDS segments
// each — walked into the layout tree once, then four arms interleaved
// round-robin, min across rounds (agent-docs/reference/BENCHMARKING.md):
//
//   glyph-layout   findGlyph per feature, the tree the emitters walk
//   emit           the emitters' walk into the collector arrays
//   pack           packRenderArrays over those arrays — the hand packer alone
//   pack-control   the same call through a second driver, the harness's floor
//   encode         the same primitives through `flatten` and `encodeFeatures`,
//                  three families, five of the eleven lanes the renderers read
//
// The question the numbers answer is whether the packer is worth re-expressing
// as the shared encoder. `encode` is a floor, not a like-for-like: it fills x,
// x2, y, colour and one integer lane per family and leaves height, strand,
// direction, widthBp, the colour class, the label rows, the child ordinal and
// the density fade unwritten, so the real port costs more than the row says.
// ADR-114 has the decision.
import { performance } from 'node:perf_hooks'

import { runTransforms } from '@jbrowse/core/util/featureTransforms'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { processFeatureRecord } from '../src/RenderFeatureDataRPC/collect/glyphEmitters.ts'
import { createCollector } from '../src/RenderFeatureDataRPC/collect/renderContext.ts'
import { findGlyph } from '../src/RenderFeatureDataRPC/glyphs/findGlyph.ts'
import { packRenderArrays } from '../src/RenderFeatureDataRPC/packRenderArrays.ts'
import { mockDisplayConfig } from '../src/RenderFeatureDataRPC/testUtils.ts'

import type { FeatureLayout } from '../src/RenderFeatureDataRPC/types.ts'
import type { Feature } from '@jbrowse/core/util'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 7)
const genes = arg('genes', 20_000)

const EXONS = 8
const ISOFORMS = 2
const GENE_BP = 20_000
const jexl = createJexlInstance()
const config = mockDisplayConfig()

function makeGene(i: number) {
  const geneStart = i * GENE_BP
  return new SimpleFeature({
    uniqueId: `gene${i}`,
    refName: 'chr1',
    start: geneStart,
    end: geneStart + GENE_BP,
    type: 'gene',
    strand: i % 2 === 0 ? 1 : -1,
    name: `GENE${i}`,
    subfeatures: Array.from({ length: ISOFORMS }, (_, t) => ({
      uniqueId: `gene${i}.${t}`,
      refName: 'chr1',
      start: geneStart,
      end: geneStart + GENE_BP,
      type: 'mRNA',
      strand: i % 2 === 0 ? 1 : -1,
      name: `GENE${i}.${t}`,
      subfeatures: Array.from({ length: EXONS }, (_, e) => {
        const start = geneStart + e * 2000 + t * 100
        return {
          uniqueId: `gene${i}.${t}.cds${e}`,
          refName: 'chr1',
          start,
          end: start + 900,
          type: 'CDS',
        }
      }),
    })),
  })
}

const features = Array.from({ length: genes }, (_, i) => makeGene(i))
const regionStart = 0
const regionEnd = genes * GENE_BP
const ctx = { config, colorByCDS: false, jexl }

function layoutAll() {
  const out: FeatureLayout[] = []
  for (const feature of features) {
    out.push(findGlyph(feature, config)({ feature, config, jexl }))
  }
  return out
}

function emitAll(layouts: readonly FeatureLayout[]) {
  const collector = createCollector()
  for (const layout of layouts) {
    processFeatureRecord(layout, ctx, collector)
  }
  return collector
}

const layouts = layoutAll()
const collector = emitAll(layouts)

// What the emitters would answer if the packer were the encoder: one container
// per primitive family holding the family's records, which `flatten` fans out
// and `encodeFeatures` walks. Built once, outside the timing, exactly as the
// collector arrays the pack arms read are.
const familyContainer = (items: object[]) =>
  ({
    get: (name: string) => (name === 'items' ? items : undefined),
    id: () => 'family',
  }) as unknown as Feature

// An arrow is a point plus a width in bp; the encoder's x/x2 want a span, so
// the family is given one before it can go through at all.
const arrowSpans = collector.arrows.map(a => ({ ...a, start: a.x, end: a.x }))

const FAMILIES = [
  familyContainer(collector.rects),
  familyContainer(collector.lines),
  familyContainer(arrowSpans),
]
const FLATTEN = [{ type: 'flatten' as const, field: 'items' }]
const LANES = ['y', 'color', 'row'] as const

function encodeFamilies() {
  let n = 0
  for (const container of FAMILIES) {
    const out = runTransforms([container], FLATTEN)
    n += encodeFeatures(
      out,
      { x: 'start', x2: 'end', y: 'y', color: 'color', row: 'flatbushIdx' },
      LANES,
    ).count
  }
  return n
}

// Separate function literals on purpose: a shared driver takes every arm's
// call site polymorphic and prices the harness rather than the code.
const drivers = [
  { name: 'glyph-layout', run: () => layoutAll().length },
  { name: 'emit', run: () => emitAll(layouts).rects.length },
  {
    name: 'pack',
    run: () =>
      packRenderArrays(
        collector.rects,
        collector.lines,
        collector.arrows,
        regionStart,
        regionEnd,
      ).rectYs.length,
  },
  {
    name: 'pack-control',
    run: () =>
      packRenderArrays(
        collector.rects,
        collector.lines,
        collector.arrows,
        regionStart,
        regionEnd,
      ).rectYs.length,
  },
  { name: 'encode', run: () => encodeFamilies() },
]

const packed = packRenderArrays(
  collector.rects,
  collector.lines,
  collector.arrows,
  regionStart,
  regionEnd,
)
const primitives =
  packed.rectYs.length + packed.lineYs.length + packed.arrowYs.length
console.log(
  `${genes.toLocaleString()} genes, ${ISOFORMS} isoforms, ${EXONS} CDS each\n` +
    `  rects=${packed.rectYs.length.toLocaleString()} ` +
    `lines=${packed.lineYs.length.toLocaleString()} ` +
    `arrows=${packed.arrowYs.length.toLocaleString()} ` +
    `total=${primitives.toLocaleString()}`,
)

for (const { name, run } of drivers) {
  console.log(`${name.padEnd(13)} ${run()}`)
}

const best = drivers.map(() => Infinity)
// Rotated as well as interleaved: run in a fixed order and the arm that goes
// second inherits the first's warmup, which on its own moved `pack-control`
// 9% off 1.00.
for (let r = 0; r < rounds; r++) {
  for (let k = 0; k < drivers.length; k++) {
    const i = (k + r) % drivers.length
    const t0 = performance.now()
    drivers[i]!.run()
    best[i] = Math.min(best[i]!, performance.now() - t0)
  }
}

const total = best[0]! + best[1]! + best[2]!
console.log(`\nrounds=${rounds}, min per arm`)
for (const [i, { name }] of drivers.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(13)} ${ms.toFixed(1).padStart(8)}ms  ` +
      `${((ms / primitives) * 1e6).toFixed(0).padStart(6)}ns/primitive  ` +
      `${((ms / total) * 100).toFixed(1).padStart(5)}% of the three  ` +
      `${(ms / best[2]!).toFixed(2)}x pack`,
  )
}
