// Did deleting `colorTagMap` move work onto the main thread?
//
//   node --expose-gc plugins/alignments/benches/tagColorBake.bench.ts
//
// Flags: --rounds=<n> (default 40), --reads=<n> (default 200000)
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. `buildReadTagColors` bakes one packed ABGR per read on the main
// thread, per region, whenever the layout re-runs under a CPU-baked colour
// scheme (tag values, or mate refNames under chromosome painting). It used to
// resolve each read through a model-held `colorTagMap` of every value the track
// had ever seen; it now computes the colour from the value itself and memoizes
// per bake. That deletes state, but it also moves a `hashString` +
// `cssColorToRgb` + `packAbgr` off a once-per-session path and onto a
// once-per-distinct-value-per-bake one — so the question is whether the bake
// got slower, and by how much at real depth.
//
// ARMS. Each is a full bake — resolver construction AND the per-read loop —
// because that is the unit the layout actually pays for. Written out longhand,
// one function literal per arm, because a shared driver goes polymorphic and
// puts the control off 1.00 (see the catalogue in BENCHMARKING.md).
//
//   pure     what ships: `bakedValueColor` behind a per-bake Map cache
//   map      what it replaced: prebuild `packedByValue` from the whole
//            colorTagMap, then `get(val) ?? 0` per read
//   control  a second, separately-declared copy of `pure`
//
// FIXTURES vary the two axes that decide the answer: how many DISTINCT values
// the reads carry (the miss path runs once each) and how big the accumulated
// map had grown (the `map` arm parses every entry of it, every bake). The third
// fixture is the one the old shape was worst at and the reason the map existed
// at all — a track panned around for a while, whose map holds hundreds of
// contigs while twenty-odd are on screen.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS at 200k reads, two runs (--rounds=40 and 60), control bracketed:
//
//   HP, 3 values, map 3          pure 1.20/1.27 ms   map 1.92x/1.87x  [0.97/1.07]
//   mateRefName, 24, map 24      pure 1.80/2.03 ms   map 1.43x/1.24x  [1.01/1.00]
//   mateRefName, 24, map 500     pure 1.91/2.26 ms   map 1.79x/1.66x  [1.01/1.01]
//
// The bake did NOT get slower for computing colours per value: it got faster in
// every fixture, and more so the longer the track had been panned, because the
// arm it replaced re-parsed the whole accumulated map on every bake while this
// one only ever touches values that are on screen. The `=== ''` fast path is
// the rest of it — a read the scheme resolved no value for skips the map lookup
// entirely, which is why the HP fixture (one read in three untagged) separates
// most.
//
// The absolute numbers are the real headline though: 1-4 ms per 200,000 reads,
// on a path that runs per region per layout. This was never a hot spot in
// either shape, and the reason to have made the change is the four cache-
// management rules it deleted, not the milliseconds.
//
// NOT measured here, because it is not a loop: the change also deleted a
// rebake CASCADE. Assigning `colorTagMap` invalidated `readColorContext`, so
// every fetch that turned up a new value re-baked every region already loaded.
// That is gone — the bake is now a function of each region's own data.
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { bakedValueColor } from '../src/LinearAlignmentsDisplay/colorTagUtils.ts'

import type { ColorBy } from '../src/shared/types.ts'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '40'))
const READS = Number(arg('reads', '200000'))

function packRgb(color: string) {
  const [r, g, b] = cssColorToRgb(color)
  return packAbgr(r, g, b, 255)
}

// ARM 1: pure — what ships. The `=== ''` test and the miss branch are the two
// things this arm pays per read that the map arm does not.
function bakePure(values: string[], colorBy: ColorBy) {
  const cache = new Map<string, number>()
  const out = new Uint32Array(values.length)
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!
    if (value === '') {
      out[i] = 0
      continue
    }
    let color = cache.get(value)
    if (color === undefined) {
      color = packRgb(bakedValueColor(colorBy, value))
      cache.set(value, color)
    }
    out[i] = color
  }
  return out
}

// ARM 2: map — what it replaced. The setup walks the WHOLE accumulated map,
// including values no read on screen carries, because it cannot know which.
function bakeMap(
  values: string[],
  colorTagMap: Record<string, string>,
): Uint32Array {
  const packedByValue = new Map<string, number>()
  for (const [k, v] of Object.entries(colorTagMap)) {
    packedByValue.set(k, packRgb(v))
  }
  const out = new Uint32Array(values.length)
  for (let i = 0; i < values.length; i++) {
    out[i] = packedByValue.get(values[i]!) ?? 0
  }
  return out
}

// ARM 3: control — a separately-declared copy of `bakePure`. Whatever this
// scores against arm 1 is what the harness could resolve; a row whose control
// is far from 1.00 measured nothing. The duplication is deliberate.
function bakeControl(values: string[], colorBy: ColorBy) {
  const cache = new Map<string, number>()
  const out = new Uint32Array(values.length)
  for (let i = 0; i < values.length; i++) {
    const value = values[i]!
    if (value === '') {
      out[i] = 0
      continue
    }
    let color = cache.get(value)
    if (color === undefined) {
      color = packRgb(bakedValueColor(colorBy, value))
      cache.set(value, color)
    }
    out[i] = color
  }
  return out
}

function time(fn: () => unknown) {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

function firstDifference(a: Uint32Array, b: Uint32Array) {
  if (a.length !== b.length) {
    return `length ${a.length} vs ${b.length}`
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return `read ${i}: ${a[i]} vs ${b[i]}`
    }
  }
  return ''
}

interface Fixture {
  name: string
  colorBy: ColorBy
  // the values the reads on screen carry, cycled
  onScreen: string[]
  // how many values the accumulated map had grown to, on-screen ones included
  mapSize: number
}

const HP: ColorBy = { type: 'tag', tag: 'HP' }
const MATE: ColorBy = { type: 'mateRefName' }

const chrom = (i: number) => `chr${i + 1}`

const fixtures: Fixture[] = [
  // Haplotype colouring: two values plus untagged reads, and the map never
  // grows past them. The case where the old shape had least to lose.
  {
    name: 'HP, 3 values, map 3',
    colorBy: HP,
    onScreen: ['1', '2', ''],
    mapSize: 3,
  },
  // Chromosome painting at one locus: mates spread over the karyotype.
  {
    name: 'mateRefName, 24 values, map 24',
    colorBy: MATE,
    onScreen: Array.from({ length: 24 }, (_, i) => chrom(i)),
    mapSize: 24,
  },
  // …and after panning. Same reads on screen; the map holds every contig the
  // track ever loaded, and the old arm re-parses all of them every bake.
  {
    name: 'mateRefName, 24 values, map 500 (panned)',
    colorBy: MATE,
    onScreen: Array.from({ length: 24 }, (_, i) => chrom(i)),
    mapSize: 500,
  },
]

function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  console.log(
    `tag-colour bake, ${READS} reads, min of ${ROUNDS} rotated rounds\n`,
  )
  for (const fx of fixtures) {
    const values = Array.from(
      { length: READS },
      (_, i) => fx.onScreen[i % fx.onScreen.length]!,
    )
    // Every value the map had accumulated, coloured exactly as the old code
    // filled it — through the same function, so the two arms cannot disagree
    // about what a value paints.
    const colorTagMap: Record<string, string> = {}
    for (const v of fx.onScreen) {
      if (v !== '') {
        colorTagMap[v] = bakedValueColor(fx.colorBy, v)
      }
    }
    for (let i = fx.onScreen.length; i < fx.mapSize; i++) {
      const v = `scaffold_${i}`
      colorTagMap[v] = bakedValueColor(fx.colorBy, v)
    }

    const outPure = bakePure(values, fx.colorBy)
    const outMap = bakeMap(values, colorTagMap)
    const outControl = bakeControl(values, fx.colorBy)
    const diffMap = firstDifference(outPure, outMap)
    const diffControl = firstDifference(outPure, outControl)
    if (diffControl) {
      throw new Error(
        `the control disagrees with the arm it was copied from (${diffControl}) — the harness is broken`,
      )
    }

    const best = { pure: Infinity, map: Infinity, ctl: Infinity }
    const sides = [
      { k: 'pure' as const, run: () => bakePure(values, fx.colorBy) },
      { k: 'map' as const, run: () => bakeMap(values, colorTagMap) },
      { k: 'ctl' as const, run: () => bakeControl(values, fx.colorBy) },
    ]
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < sides.length; i++) {
        const side = sides[(round + i) % sides.length]!
        best[side.k] = Math.min(best[side.k], time(side.run))
      }
    }
    const x = (v: number) => `${(v / best.pure).toFixed(3)}x`
    console.log(
      `${fx.name}\n` +
        `  pure (ships)  ${best.pure.toFixed(3).padStart(8)} ms\n` +
        `  map (was)     ${best.map.toFixed(3).padStart(8)} ms   ${x(best.map)}   ` +
        `output ${diffMap ? `DIFFERS — ${diffMap}` : 'identical'}\n` +
        `  control       ${best.ctl.toFixed(3).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
    )
  }
}

main()
