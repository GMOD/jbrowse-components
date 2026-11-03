// How much memory do the fit ladder's caches pin once the ladder stops reaching
// them and the store has evicted the regions they were built from?
//
//   node --expose-gc plugins/features/benches/fitLadderRetention.bench.ts
//   node --expose-gc plugins/features/benches/fitLadderRetention.bench.ts --features=60000 --probes=22
//
// One display holds seven incremental layouts and three pack caches
// (`fitLadderVolatiles`). This fills each the way a fit solve does, evicts the
// raw regions, and reads the heap (plus ArrayBuffers) with the caches kept and
// then after `clear()` on each.
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
  reversedRegions: new Set(),
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

const baseline = usedMb()
const holder: {
  raw: Map<number, LayoutRegionData> | undefined
  layouts: ReturnType<typeof createIncrementalLayout>[]
  caches: ReturnType<typeof createPackHeightCache>[]
} = {
  raw: new Map([
    [
      0,
      {
        ...makeDenseRegion('r', features, exons),
        regionKey: 'volvox:ctgA',
        regionStart: 0,
        regionEnd: Number.MAX_SAFE_INTEGER,
      },
    ],
  ]),
  layouts: reservations.map(() => createIncrementalLayout()),
  caches: [
    createPackHeightCache(),
    createPackHeightCache(),
    createPackHeightCache(),
  ],
}
const afterRaw = usedMb()

function fillLayouts() {
  for (const [i, layout] of holder.layouts.entries()) {
    layout(holder.raw!, { ...baseInputs, ...reservations[i] })
  }
}

function fillProbes() {
  for (const cache of holder.caches) {
    const heightAt = createContentHeightProbe(
      holder.raw!,
      baseInputs,
      undefined,
      cache,
    )
    for (let k = 0; k < probes; k++) {
      heightAt(0.2 + k * 0.05)
    }
  }
}

const t0 = performance.now()
fillLayouts()
const layoutMs = performance.now() - t0
const afterLayouts = usedMb()

const t1 = performance.now()
fillProbes()
const probeMs = performance.now() - t1
const afterProbes = usedMb()

holder.raw = undefined
const evictedCachesKept = usedMb()

for (const memo of [...holder.layouts, ...holder.caches]) {
  memo.clear()
}
const evictedCachesCleared = usedMb()

const mb = (n: number) => `${n.toFixed(1)}MB`
console.log(
  `${features.toLocaleString()} features x ${exons} exons, ${reservations.length} layouts, ` +
    `${holder.caches.length} pack caches x ${probes} probes (${layoutMs.toFixed(0)}ms + ${probeMs.toFixed(0)}ms to fill)`,
)
console.log(`raw region                      ${mb(afterRaw - baseline)}`)
console.log(`7 incremental layouts           ${mb(afterLayouts - afterRaw)}`)
console.log(`3 pack caches                   ${mb(afterProbes - afterLayouts)}`)
console.log(
  `raw evicted, caches kept        ${mb(evictedCachesKept - baseline)} above baseline`,
)
console.log(
  `raw evicted, caches cleared     ${mb(evictedCachesCleared - baseline)} above baseline`,
)
console.log(
  `pinned by the caches            ${mb(evictedCachesKept - evictedCachesCleared)}`,
)
