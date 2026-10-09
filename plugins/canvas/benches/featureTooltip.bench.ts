// What does the default `mouseover` cost the canvas worker, which evaluates it
// for every feature whether or not anyone hovers?
//
//   node plugins/canvas/benches/featureTooltip.bench.ts
//   node plugins/canvas/benches/featureTooltip.bench.ts --rounds=9 --genes=20000
//   node plugins/canvas/benches/featureTooltip.bench.ts --boxes=200000
//
// packRenderArrays.bench.ts's synthetic gene track, or with `--boxes` that
// many single-span features, a BED or repeat track's shape, where the emit
// per record is cheapest and the tooltip's share largest; its arms interleaved
// round-robin, min across rounds (agent-docs/reference/BENCHMARKING.md):
//
//   emit             the emitters' walk, which reads the tooltip once per
//                    feature record, the whole the share is taken of
//   jexl             the default slot through jexl per record, which `emit`
//                    paid before `defaultMouseover`
//   jexl-control     the same call through a second driver, the floor
//   reader           `tooltipReader`'s answer for the default slot, the
//                    native function `emit` pays now
import { performance } from 'node:perf_hooks'

import createJexlInstance from '@jbrowse/core/util/jexl'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { tooltipReader } from '../src/RenderFeatureDataRPC/collect/glyphColors.ts'
import { processFeatureRecord } from '../src/RenderFeatureDataRPC/collect/glyphEmitters.ts'
import { createCollector } from '../src/RenderFeatureDataRPC/collect/renderContext.ts'
import { DEFAULT_MOUSEOVER } from '../src/RenderFeatureDataRPC/featureMouseover.ts'
import { findGlyph } from '../src/RenderFeatureDataRPC/glyphs/findGlyph.ts'
import { getFeatureName } from '../src/RenderFeatureDataRPC/labelUtils.ts'
import { readConfigValueSafe } from '../src/RenderFeatureDataRPC/renderConfig.ts'
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
const boxes = arg('boxes', 0)

const EXONS = 8
const ISOFORMS = 2
const GENE_BP = 20_000
const jexl = createJexlInstance()
const config = { ...mockDisplayConfig(), mouseover: DEFAULT_MOUSEOVER }

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

function makeBox(i: number) {
  return new SimpleFeature({
    uniqueId: `box${i}`,
    refName: 'chr1',
    start: i * 300,
    end: i * 300 + 200,
    type: 'repeat_region',
    strand: i % 2 === 0 ? 1 : -1,
    name: `rpt${i}`,
  })
}

const features =
  boxes > 0
    ? Array.from({ length: boxes }, (_, i) => makeBox(i))
    : Array.from({ length: genes }, (_, i) => makeGene(i))
const ctx = {
  config,
  colorByCDS: false,
  jexl,
  tooltipOf: tooltipReader(config, jexl),
}
const layouts: FeatureLayout[] = features.map(feature =>
  findGlyph(feature, config)({ feature, config, jexl }),
)

// The records the emitters evaluate a tooltip for: one flatbush item each.
const records = (() => {
  const collector = createCollector()
  for (const layout of layouts) {
    processFeatureRecord(layout, ctx, collector)
  }
  const byId = new Map<string, Feature>()
  const walk = (f: Feature) => {
    byId.set(f.id(), f)
    for (const sub of f.get('subfeatures') ?? []) {
      walk(sub)
    }
  }
  features.forEach(walk)
  return collector.flatbushItems.map(item => byId.get(item.featureId)!)
})()

function jexlTooltip(f: Feature) {
  return String(
    readConfigValueSafe<unknown>(
      config,
      'mouseover',
      f,
      jexl,
      getFeatureName(f) ?? '',
    ),
  )
}
const reader = tooltipReader(config, jexl)

let sink = 0
// Separate function literals on purpose: a shared driver takes every arm's
// call site polymorphic and prices the harness rather than the code.
const drivers = [
  {
    name: 'emit',
    run: () => {
      const collector = createCollector()
      for (const layout of layouts) {
        processFeatureRecord(layout, ctx, collector)
      }
      return collector.flatbushItems.length
    },
  },
  {
    name: 'jexl',
    run: () => {
      for (const f of records) {
        sink += jexlTooltip(f).length
      }
      return records.length
    },
  },
  {
    name: 'jexl-control',
    run: () => {
      for (const f of records) {
        sink += jexlTooltip(f).length
      }
      return records.length
    },
  },
  {
    name: 'reader',
    run: () => {
      for (const f of records) {
        sink += reader(f).length
      }
      return records.length
    },
  },
]

console.log(
  `${boxes > 0 ? `${boxes.toLocaleString()} single-span features` : `${genes.toLocaleString()} genes, ${ISOFORMS} isoforms, ${EXONS} CDS each`}, ` +
    `${records.length.toLocaleString()} tooltip records`,
)
for (const f of records.slice(0, 3)) {
  if (reader(f) !== jexlTooltip(f)) {
    throw new Error(`native and jexl disagree on ${f.id()}`)
  }
}

const best = drivers.map(() => Infinity)
// Rotated as well as interleaved, so no arm always inherits another's warmup.
for (let r = 0; r < rounds; r++) {
  for (let k = 0; k < drivers.length; k++) {
    const i = (k + r) % drivers.length
    const t0 = performance.now()
    drivers[i]!.run()
    best[i] = Math.min(best[i]!, performance.now() - t0)
  }
}

console.log(`\nrounds=${rounds}, min per arm (sink ${sink > 0})`)
for (const [i, { name }] of drivers.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(16)} ${ms.toFixed(1).padStart(8)}ms  ` +
      `${((ms / records.length) * 1e6).toFixed(0).padStart(6)}ns/record  ` +
      `${((ms / best[0]!) * 100).toFixed(1).padStart(5)}% of emit`,
  )
}
