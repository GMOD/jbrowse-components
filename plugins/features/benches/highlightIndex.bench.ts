// What does one hover-enter cost when every region's highlight index is rebuilt,
// and what does it cost once the per-region memo holds them?
//
//   node plugins/features/benches/highlightIndex.bench.ts
//   node plugins/features/benches/highlightIndex.bench.ts --features=60000 --regions=3 --exons=8
import { performance } from 'node:perf_hooks'

import {
  buildRegionInstanceIndex,
  createRegionInstanceIndexMemo,
} from '../src/LinearBasicDisplay/featureHighlightInk.ts'
import { arg, makeDenseRegion } from './denseRegion.ts'

const features = arg('features', 60_000)
const regions = arg('regions', 3)
const rounds = arg('rounds', 9)
const exons = arg('exons', 8)

const data = Array.from({ length: regions }, (_, r) =>
  makeDenseRegion(`r${r}`, features, exons),
)
console.log(
  `${regions} regions x ${features.toLocaleString()} features, ` +
    `${exons} exons each, ${data[0]!.subfeatureInfos.length.toLocaleString()} subfeatureInfos/region`,
)

const times: number[] = []
for (let r = 0; r < rounds; r++) {
  const t0 = performance.now()
  for (const d of data) {
    buildRegionInstanceIndex(d)
  }
  times.push(performance.now() - t0)
}
console.log(
  `all regions, one hover-enter: min ${Math.min(...times).toFixed(1)}ms, ` +
    `rounds ${times.map(t => t.toFixed(0)).join(' ')}`,
)

const one: number[] = []
for (let r = 0; r < rounds; r++) {
  const t0 = performance.now()
  buildRegionInstanceIndex(data[0]!)
  one.push(performance.now() - t0)
}
console.log(`one region: min ${Math.min(...one).toFixed(1)}ms`)

const indexesOf = createRegionInstanceIndexMemo()
const regionMap = new Map(data.entries())
const t0 = performance.now()
indexesOf(regionMap)
const firstEnter = performance.now() - t0
const t1 = performance.now()
indexesOf(regionMap)
const nextEnter = performance.now() - t1
console.log(
  `memo: first hover-enter ${firstEnter.toFixed(1)}ms, ` +
    `every later one ${nextEnter.toFixed(3)}ms`,
)
