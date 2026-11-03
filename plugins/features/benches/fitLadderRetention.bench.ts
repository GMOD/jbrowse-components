// How much memory do the fit ladder's caches pin once the ladder stops reaching
// them and the store has evicted the regions they were built from?
//
//   node --expose-gc plugins/features/benches/fitLadderRetention.bench.ts
//   node --expose-gc plugins/features/benches/fitLadderRetention.bench.ts --features=60000 --probes=22
//
// One display holds seven incremental layouts and three pack caches (in
// `featureBandViews`' closure). A dense locus is solved through every one of
// them, then the view moves to a sparse locus that only the `full` rung
// reaches and the dense region is evicted. The heap (plus ArrayBuffers) is read with the
// memos untouched, after `prune()` to the live regions as every fit solve does,
// and after `clear()` as leaving fit mode does.
import {
  createContentHeightProbe,
  createIncrementalLayout,
  createPackHeightCache,
} from '../src/LinearBasicDisplay/layout.ts'
import { arg, makeDenseRegion } from './denseRegion.ts'

import type {
  LayoutInputs,
  LayoutRegionData,
} from '../src/LinearBasicDisplay/layoutInputs.ts'

const features = arg('features', 20_000)
const exons = arg('exons', 8)
const probes = arg('probes', 22)

function usedMb() {
  globalThis.gc?.()
  globalThis.gc?.()
  const { heapUsed, arrayBuffers } = process.memoryUsage()
  return (heapUsed + arrayBuffers) / 1024 / 1024
}

const baseInputs: LayoutInputs = {
  bpPerPx: 20,
  showLabels: true,
  showDescriptions: false,
  displayMode: 'normal',
  pinnedFeatureIds: new Set(),
  expandedGeneIds: new Set(),
}

const reservations = [
  {},
  { showLabels: false },
  { showLabels: false, dropBelowLabelRows: true },
  { labelRoomFactor: 0.5 },
  { maxIsoformsPerGene: 1 },
  { bodyScale: 0.7 },
  { bodyScale: 0.5, showLabels: false },
]

function regionMap(name: string, count: number) {
  return new Map<number, LayoutRegionData>([
    [
      0,
      {
        ...makeDenseRegion(name, count, exons),
        regionKey: 'volvox:ctgA',
        regionStart: 0,
        regionEnd: Number.MAX_SAFE_INTEGER,
        reversed: false,
      },
    ],
  ])
}

const fullLayout = createIncrementalLayout()
const layouts = [
  fullLayout,
  ...reservations.slice(1).map(() => createIncrementalLayout()),
]
const caches = [
  createPackHeightCache(),
  createPackHeightCache(),
  createPackHeightCache(),
]

function solveDenseLocus() {
  const dense = regionMap('d', features)
  const t0 = performance.now()
  for (const [i, layout] of layouts.entries()) {
    layout(dense, { ...baseInputs, ...reservations[i] })
  }
  const layoutMs = performance.now() - t0
  const t1 = performance.now()
  for (const cache of caches) {
    const heightAt = createContentHeightProbe(
      dense,
      baseInputs,
      undefined,
      cache,
    )
    for (let k = 0; k < probes; k++) {
      heightAt(0.2 + k * 0.05)
    }
  }
  return { layoutMs, probeMs: performance.now() - t1 }
}

const baseline = usedMb()
const { layoutMs, probeMs } = solveDenseLocus()
const afterDense = usedMb()

const sparse = regionMap('s', Math.max(10, Math.floor(features / 1000)))
fullLayout(sparse, baseInputs)
const sparseOnly = usedMb()

for (const memo of [...layouts, ...caches]) {
  memo.prune(sparse)
}
const pruned = usedMb()

for (const memo of [...layouts, ...caches]) {
  memo.clear()
}
const cleared = usedMb()

const mb = (n: number) => `${n.toFixed(1)}MB`
console.log(
  `${features.toLocaleString()} features x ${exons} exons, ${layouts.length} layouts, ` +
    `${caches.length} pack caches x ${probes} probes (${layoutMs.toFixed(0)}ms + ${probeMs.toFixed(0)}ms to fill)`,
)
console.log(`dense solve, every memo filled      ${mb(afterDense - baseline)}`)
console.log(`dense evicted, sparse full rung     ${mb(sparseOnly - baseline)}`)
console.log(`  after prune to the live regions   ${mb(pruned - baseline)}`)
console.log(`  after clear (left fit mode)       ${mb(cleared - baseline)}`)
