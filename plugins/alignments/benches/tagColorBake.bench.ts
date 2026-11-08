// Does dealing a region's new tag values after the walk cost the bake?
//
//   node --expose-gc --experimental-strip-types plugins/alignments/benches/tagColorBake.bench.ts
//
// Flags: --rounds=<n> (default 40), --reads=<n> (default 200000)
//
// The harness rules (interleave, min-of-rounds, run a control, check identity
// before believing timing) are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. `buildReadFillColors` bakes one packed ABGR per read on the main
// thread, per region, whenever the layout re-runs under a CPU-baked color
// field. Tag values are dealt colors (ADR-205), so a collided pair's colors
// depend on the order values are dealt in. The bake deals a region's unseen
// values together after its walk, in value order, so read order cannot decide
// them: each unseen read is marked and filled in a second pass. The question is
// what that second pass costs against resolving each value at its first read.
//
// ARMS. Each is a full bake, written longhand, one function literal per arm,
// because a shared driver goes polymorphic and puts the control off 1.00.
//
//   deferred   what ships: a value the deal has yet to place is marked and
//              dealt in value order after the walk; a settled one packs at once
//   immediate  resolve a value at its first read, in read order
//   control    a second, separately-declared copy of `deferred`
//
// Every arm reads one `held` map dealt before timing, so the outputs agree and
// the timing is the steady state a pan or relayout pays; the deal itself runs
// once per value per session.
//
// WHAT IT SAYS on ada at 200k reads, 60 rounds. Deferring every unseen read
// (the first cut, with no settled check) cost 1.6-2.0x: HP 1.06 vs 0.59 ms,
// RG 1.84 vs 1.17, mateRefName 1.90 vs 0.97, control 0.99-1.01. That is why a
// value already held packs at its first read.
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import {
  bakedValueOrder,
  undeclaredValueColor,
} from '../src/LinearAlignmentsDisplay/colorTagUtils.ts'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '40'))
const READS = Number(arg('reads', '200000'))
const PENDING = 1

type Color = (value: string) => string
type Settled = (value: string) => boolean

function packRgb(color: string) {
  const [r, g, b] = cssColorToRgb(color)
  return packAbgr(r, g, b, 255)
}

function bakeDeferred(values: string[], color: Color, settled: Settled) {
  const cache = new Map<string, number>()
  const n = values.length
  const out = new Uint32Array(n)
  const unseen = new Set<string>()
  for (let i = 0; i < n; i++) {
    const value = values[i]!
    if (value !== '') {
      let c = cache.get(value)
      if (c === undefined) {
        if (settled(value)) {
          c = packRgb(color(value))
        } else {
          unseen.add(value)
          c = PENDING
        }
        cache.set(value, c)
      }
      out[i] = c
    }
  }
  if (unseen.size > 0) {
    const sorted = [...unseen]
    for (const value of sorted.sort(bakedValueOrder(sorted))) {
      cache.set(value, packRgb(color(value)))
    }
    for (let i = 0; i < n; i++) {
      if (out[i] === PENDING) {
        out[i] = cache.get(values[i]!)!
      }
    }
  }
  return out
}

function bakeImmediate(values: string[], color: Color) {
  const cache = new Map<string, number>()
  const n = values.length
  const out = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const value = values[i]!
    if (value !== '') {
      let c = cache.get(value)
      if (c === undefined) {
        c = packRgb(color(value))
        cache.set(value, c)
      }
      out[i] = c
    }
  }
  return out
}

function bakeControl(values: string[], color: Color, settled: Settled) {
  const cache = new Map<string, number>()
  const n = values.length
  const out = new Uint32Array(n)
  const unseen = new Set<string>()
  for (let i = 0; i < n; i++) {
    const value = values[i]!
    if (value !== '') {
      let c = cache.get(value)
      if (c === undefined) {
        if (settled(value)) {
          c = packRgb(color(value))
        } else {
          unseen.add(value)
          c = PENDING
        }
        cache.set(value, c)
      }
      out[i] = c
    }
  }
  if (unseen.size > 0) {
    const sorted = [...unseen]
    for (const value of sorted.sort(bakedValueOrder(sorted))) {
      cache.set(value, packRgb(color(value)))
    }
    for (let i = 0; i < n; i++) {
      if (out[i] === PENDING) {
        out[i] = cache.get(values[i]!)!
      }
    }
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

const fixtures = [
  {
    name: 'HP, 2 values and untagged',
    field: 'tags.HP',
    onScreen: ['1', '2', ''],
  },
  {
    name: 'RG, 12 read groups',
    field: 'tags.RG',
    onScreen: Array.from({ length: 12 }, (_, i) => `HG00${i + 1}`),
  },
  {
    name: 'mateRefName, 24 chromosomes',
    field: 'mateRefName',
    onScreen: Array.from({ length: 24 }, (_, i) => `chr${i + 1}`),
  },
]

function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  console.log(
    `tag-color bake, ${READS} reads, min of ${ROUNDS} rotated rounds\n`,
  )
  for (const fx of fixtures) {
    const values = Array.from(
      { length: READS },
      (_, i) => fx.onScreen[i % fx.onScreen.length]!,
    )
    const held = new Map<string, number>()
    const color = undeclaredValueColor(fx.field, undefined, held)
    const settled = (value: string) =>
      fx.field === 'mateRefName' || held.has(value)
    const outDeferred = bakeDeferred(values, color, settled)
    const diffImmediate = firstDifference(
      outDeferred,
      bakeImmediate(values, color),
    )
    const diffControl = firstDifference(
      outDeferred,
      bakeControl(values, color, settled),
    )
    if (diffControl) {
      throw new Error(
        `the control disagrees with the arm it was copied from (${diffControl}): the harness is broken`,
      )
    }
    const best = { deferred: Infinity, immediate: Infinity, ctl: Infinity }
    const sides = [
      {
        k: 'deferred' as const,
        run: () => bakeDeferred(values, color, settled),
      },
      { k: 'immediate' as const, run: () => bakeImmediate(values, color) },
      { k: 'ctl' as const, run: () => bakeControl(values, color, settled) },
    ]
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < sides.length; i++) {
        const side = sides[(round + i) % sides.length]!
        best[side.k] = Math.min(best[side.k], time(side.run))
      }
    }
    const x = (v: number) => `${(v / best.deferred).toFixed(3)}x`
    console.log(
      `${fx.name}\n` +
        `  deferred (ships)  ${best.deferred.toFixed(3).padStart(8)} ms\n` +
        `  immediate         ${best.immediate.toFixed(3).padStart(8)} ms   ${x(best.immediate)}   ` +
        `output ${diffImmediate ? `DIFFERS: ${diffImmediate}` : 'identical'}\n` +
        `  control           ${best.ctl.toFixed(3).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
    )
  }
}

main()
