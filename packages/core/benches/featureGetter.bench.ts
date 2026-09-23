// What a transform step's derived feature pays for how its `get` is spelled:
// a class-field arrow allocates a closure per instance beside the object, a
// prototype method is shared. Two synthetic classes of the shape `bin` makes
// (a record of new fields over a base feature), interleaved in one process,
// min over rounds; `agent-docs/measurements/feature-getter-prototype.json`
// holds the numbers.
//
//   node packages/core/benches/featureGetter.bench.ts
//   node packages/core/benches/featureGetter.bench.ts --rounds=9 --features=1000000
import { performance } from 'node:perf_hooks'

import SimpleFeature from '../src/util/simpleFeature.ts'

import type { Feature } from '../src/util/simpleFeature.ts'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 7)
const n = arg('features', 1_000_000)

class ArrowDerived {
  private readonly base: Feature
  private readonly fields: Record<string, unknown>
  constructor(base: Feature, fields: Record<string, unknown>) {
    this.base = base
    this.fields = fields
  }
  get = (name: string): unknown =>
    name in this.fields ? this.fields[name] : this.base.get(name)
}

class PrototypeDerived {
  private readonly base: Feature
  private readonly fields: Record<string, unknown>
  constructor(base: Feature, fields: Record<string, unknown>) {
    this.base = base
    this.fields = fields
  }
  get(name: string): unknown {
    return name in this.fields ? this.fields[name] : this.base.get(name)
  }
}

type Derived = ArrowDerived | PrototypeDerived

const features = Array.from({ length: n }, (_, i) => {
  const start = i * 3
  return new SimpleFeature({
    uniqueId: `f${i}`,
    refName: 'chr1',
    start,
    end: start + 2 + (i % 5),
    score: (i * 7919) % 1000,
  })
})

function bin(
  Cls: new (base: Feature, fields: Record<string, unknown>) => Derived,
) {
  const out: Derived[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const f = features[i]!
    const s = Math.floor(f.get('start') / 10_000) * 10_000
    out[i] = new Cls(f, { start: s, end: s + 10_000 })
  }
  return out
}

function walk(list: Derived[]) {
  let acc = 0
  for (let i = 0; i < n; i++) {
    const f = list[i]!
    acc += (f.get('start') as number) + (f.get('score') as number)
  }
  return acc
}

const ARMS = [
  {
    name: 'construct',
    arrow: () => bin(ArrowDerived),
    proto: () => bin(PrototypeDerived),
  },
  {
    name: 'construct and read two fields',
    arrow: () => walk(bin(ArrowDerived)),
    proto: () => walk(bin(PrototypeDerived)),
  },
]

const best = new Map<string, number>()
for (let r = 0; r < rounds; r++) {
  for (const { name, arrow, proto } of ARMS) {
    for (const [tag, fn] of [
      ['arrow', arrow],
      ['prototype', proto],
    ] as const) {
      const t = performance.now()
      fn()
      const ms = performance.now() - t
      const key = `${name} ${tag}`
      best.set(key, Math.min(best.get(key) ?? Infinity, ms))
    }
  }
}

console.log(`rounds=${rounds}, ${n.toLocaleString()} features, min per arm`)
for (const { name } of ARMS) {
  const a = best.get(`${name} arrow`)!
  const p = best.get(`${name} prototype`)!
  console.log(
    `  ${name.padEnd(30)} arrow ${a.toFixed(0).padStart(5)}ms  prototype ${p.toFixed(0).padStart(5)}ms  ${(p / a).toFixed(2)}x`,
  )
}
