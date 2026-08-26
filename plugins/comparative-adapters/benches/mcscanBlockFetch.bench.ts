// What does bucketing an MCScan file's joined rows by refName buy a fetch?
//
//   node plugins/comparative-adapters/benches/mcscanBlockFetch.bench.ts
//   node plugins/comparative-adapters/benches/mcscanBlockFetch.bench.ts --rounds=15
//
// Every MCScan format holds its whole file in memory and answers a query by
// walking it. A query names one refName, so the walk visited every row in the
// file to find the ones on one contig — and it ran once per REGION. A
// whole-genome synteny view asks for one region per displayed contig, which made
// the fetch quadratic in the file's own contig count: 29 grape regions against
// the 15,265 joined rows of jcvi's grape/peach anchors is 442,685 row visits to
// emit 15,265 features.
//
// TWO ROWS PER ARM, and they answer different questions. `whole genome` is the
// view at its default zoom, where the region count is what the buckets remove.
// `one locus` is what a pan or a zoom costs: one region, and the buckets are
// what stops it from paying for the other 28 contigs. The second row is the one
// that runs on every frame, so quoting only the first would be a story.
//
// Read `agent-docs/reference/BENCHMARKING.md` first.
//
// SEPARATE DRIVERS, WRITTEN OUT LONGHAND. `scanAllA` and `scanAllB` are two
// separately-written copies of the walk this replaced. B is the control, and its
// ratio against A is the floor any claim here has to clear.
//
// SETUP IS HOISTED, INCLUDING THE BUCKET BUILD. The download, the BED parse, the
// join and the buckets all happen once per adapter: `indexBlockRows` hangs off
// the same `cachedSetup` promise the joined rows do, and builds a side on
// first use. So a fetch never pays for it, and timing a rebuild per round prices
// something no caller does — which is not a small distinction. An earlier
// version of this bench did exactly that and reported the one-locus row at
// 0.68x, i.e. the change making a pan SLOWER, purely because building 15,265
// rows' worth of buckets outweighs one region's scan.
//
// The build is reported on its own line instead, next to the per-fetch saving,
// so the payback is visible rather than assumed.
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import { SimpleFeature, doesIntersect2 } from '@jbrowse/core/util'

import {
  anchorScore,
  indexBlockRows,
  joinBedPair,
  makeBlockFeatures,
} from '../src/mcscanUtil.ts'
import { parseBed } from '../src/util.ts'

import type { BlockRow } from '../src/mcscanUtil.ts'
import type { Feature, Region } from '@jbrowse/core/util'

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.split('=')[1] ?? 25,
)
const allowDiff = process.argv.includes('--allow-diff')

const dir = new URL('../src/MCScanAnchorsAdapter/test_data/', import.meta.url)
  .pathname
const read = (name: string) =>
  gunzipSync(readFileSync(`${dir}${name}`)).toString('utf8')

const bed1 = parseBed(read('grape.bed.gz'))
const bed2 = parseBed(read('peach.bed.gz'))
const rows: BlockRow[] = []
for (const line of read('grape.peach.anchors.gz').split('\n')) {
  if (line && line !== '###') {
    const [name1, name2, score] = line.split('\t')
    const pair = joinBedPair(bed1, bed2, name1, name2)
    if (pair) {
      rows.push({
        ...pair,
        rowNum: rows.length,
        strand: pair.a.strand * pair.b.strand,
        score: anchorScore(score),
      })
    }
  }
}
const assemblyNames = ['grape', 'peach']

// baseline: walk every row of the file, per region
function scanAllA(names: string[], feats: BlockRow[], region: Region) {
  const out: Feature[] = []
  for (const index of names.flatMap((name, idx) =>
    name === region.assemblyName ? [idx] : [],
  )) {
    const mateIndex = index === 0 ? 1 : 0
    for (const { a, b, rowNum, strand, score, attrs } of feats) {
      const [f1, f2] = index === 0 ? [a, b] : [b, a]
      if (
        f1.refName === region.refName &&
        doesIntersect2(region.start, region.end, f1.start, f1.end)
      ) {
        out.push(
          new SimpleFeature({
            ...attrs,
            ...f1,
            uniqueId: `${index}-${rowNum}`,
            syntenyId: rowNum,
            strand,
            assemblyName: names[index]!,
            ...(score === undefined ? undefined : { score }),
            mate: { ...f2, assemblyName: names[mateIndex]! },
          }),
        )
      }
    }
  }
  return out
}

// control: the same walk, written out a second time for its own inline caches
function scanAllB(asms: string[], links: BlockRow[], query: Region) {
  const result: Feature[] = []
  for (const which of asms.flatMap((asm, i) =>
    asm === query.assemblyName ? [i] : [],
  )) {
    const other = which === 0 ? 1 : 0
    for (const { a, b, rowNum, strand, score, attrs } of links) {
      const [near, far] = which === 0 ? [a, b] : [b, a]
      if (
        near.refName === query.refName &&
        doesIntersect2(query.start, query.end, near.start, near.end)
      ) {
        result.push(
          new SimpleFeature({
            ...attrs,
            ...near,
            uniqueId: `${which}-${rowNum}`,
            syntenyId: rowNum,
            strand,
            assemblyName: asms[which]!,
            ...(score === undefined ? undefined : { score }),
            mate: { ...far, assemblyName: asms[other]! },
          }),
        )
      }
    }
  }
  return result
}

function describeDiff(a: Feature[], b: Feature[]) {
  if (a.length !== b.length) {
    return `feature count ${a.length} vs ${b.length}`
  }
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!.toJSON()
    const right = b[i]!.toJSON()
    const leftJson = JSON.stringify(left)
    const rightJson = JSON.stringify(right)
    if (leftJson !== rightJson) {
      return `feature ${i} (${left.uniqueId}): ${leftJson} vs ${rightJson}`
    }
  }
  return undefined
}

const grapeRefNames = [...new Set(rows.map(r => r.a.refName))]
const wholeGenome: Region[] = grapeRefNames.map(refName => ({
  refName,
  start: 0,
  end: 100_000_000,
  assemblyName: 'grape',
}))
// one contig at the zoom a synteny view lands on after a click-through
const oneLocus: Region[] = [
  { refName: 'chr1', start: 0, end: 2_000_000, assemblyName: 'grape' },
]

for (const [label, regions] of [
  ['whole genome', wholeGenome],
  ['one locus', oneLocus],
] as const) {
  // warm every arm the same way, and check identity before believing any timing
  const expected = regions.flatMap(r => scanAllA(assemblyNames, rows, r))
  const index = indexBlockRows(rows)
  const diffCandidate = describeDiff(
    expected,
    regions.flatMap(r => makeBlockFeatures(assemblyNames, index, r)),
  )
  const diffControl = describeDiff(
    expected,
    regions.flatMap(r => scanAllB(assemblyNames, rows, r)),
  )
  if ((diffCandidate ?? diffControl) !== undefined) {
    const message = `${label}: candidate ${diffCandidate ?? 'ok'}, control ${diffControl ?? 'ok'}`
    if (!allowDiff) {
      throw new Error(`${message} (pass --allow-diff if deliberate)`)
    }
    console.log(`DIFF ${message}`)
  }

  let bestScan = Number.POSITIVE_INFINITY
  let bestBucketed = Number.POSITIVE_INFINITY
  let bestControl = Number.POSITIVE_INFINITY
  let bestBuild = Number.POSITIVE_INFINITY
  for (let round = 0; round < rounds; round++) {
    let t = performance.now()
    for (const region of regions) {
      scanAllA(assemblyNames, rows, region)
    }
    bestScan = Math.min(bestScan, performance.now() - t)

    t = performance.now()
    for (const region of regions) {
      makeBlockFeatures(assemblyNames, index, region)
    }
    bestBucketed = Math.min(bestBucketed, performance.now() - t)

    t = performance.now()
    for (const region of regions) {
      scanAllB(assemblyNames, rows, region)
    }
    bestControl = Math.min(bestControl, performance.now() - t)

    // the once-per-adapter cost, timed on its own: a fresh index whose one side
    // is forced, which is what a pairwise track's first fetch builds
    t = performance.now()
    indexBlockRows(rows).bySide(0)
    bestBuild = Math.min(bestBuild, performance.now() - t)
  }

  const saved = bestScan - bestBucketed
  console.log(
    `${label} — ${regions.length} region(s), ${rows.length} rows, ${expected.length} features\n` +
      `  scan all (baseline)  ${bestScan.toFixed(2)}ms\n` +
      `  bucketed by refName  ${bestBucketed.toFixed(2)}ms  ${(bestScan / bestBucketed).toFixed(2)}x\n` +
      `  scan all (control)   ${bestControl.toFixed(2)}ms  ${(bestScan / bestControl).toFixed(2)}x\n` +
      `  bucket build, once   ${bestBuild.toFixed(2)}ms  (pays back after ${Math.ceil(bestBuild / saved)} fetch(es))`,
  )
}
