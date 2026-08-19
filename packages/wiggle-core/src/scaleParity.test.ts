import {
  type ScaleSpec,
  niceDomain,
  scaleTicks,
  scaleValue,
} from './vendor/d3-scale.ts'

// What d3-scale 4.0.2 answers, recorded from the chainable port these pure
// functions replaced. The table is the whole point: `scale.test.ts` and
// `symlogScale.test.ts` both stayed green through two rewrites of this module
// that changed real answers, because neither reaches the cases below.
//
// Two of those cases are in here by name, having actually broken:
//
//   [5, 5]      A degenerate domain, which is what a flat coverage track hands
//               over. d3 commits a niced domain only where the tick step
//               converges and leaves this one alone; returning the loop's
//               intermediate values gives the axis NaN endpoints.
//   [-100, -1]  A negative log domain, where both logarithms are NaN. d3 ticks
//               it as an empty array, and since every comparison against NaN is
//               false, `!(a < b)` and `a >= b` send it down different branches
//               — the second invents linear ticks for it.
//
// Regenerate only against real d3, never against this module's own output.
interface ParityCase {
  spec: ScaleSpec
  nice: number[]
  ticks: number[]
  at: number[]
}

const CASES: ParityCase[] = [
  {
    spec: { kind: 'linear', domain: [0, 1], range: [0, 500] },
    nice: [0, 1],
    ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
    at: [0, 500, 250],
  },
  {
    spec: { kind: 'symlog', constant: 1, domain: [0, 1], range: [0, 500] },
    nice: [0, 1],
    ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
    at: [0, 500, 0],
  },
  {
    spec: { kind: 'symlog', constant: 0.01, domain: [0, 1], range: [0, 500] },
    nice: [0, 1],
    ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
    at: [0, 500, 0],
  },
  {
    spec: { kind: 'linear', domain: [0, 100], range: [0, 500] },
    nice: [0, 100],
    ticks: [0, 20, 40, 60, 80, 100],
    at: [0, 500, 250],
  },
  {
    spec: { kind: 'symlog', constant: 1, domain: [0, 100], range: [0, 500] },
    nice: [0, 100],
    ticks: [0, 20, 40, 60, 80, 100],
    at: [0, 500, 0],
  },
  {
    spec: { kind: 'symlog', constant: 0.01, domain: [0, 100], range: [0, 500] },
    nice: [0, 100],
    ticks: [0, 20, 40, 60, 80, 100],
    at: [0, 500, 0],
  },
  {
    spec: { kind: 'linear', domain: [1, 1000], range: [0, 500] },
    nice: [0, 1000],
    ticks: [200, 400, 600, 800, 1000],
    at: [0, 500, 250],
  },
  {
    spec: { kind: 'symlog', constant: 1, domain: [1, 1000], range: [0, 500] },
    nice: [0, 1000],
    ticks: [200, 400, 600, 800, 1000],
    at: [0, 500, -55.758601998841876],
  },
  {
    spec: {
      kind: 'symlog',
      constant: 0.01,
      domain: [1, 1000],
      range: [0, 500],
    },
    nice: [0, 1000],
    ticks: [200, 400, 600, 800, 1000],
    at: [0, 500, -334.5349615479728],
  },
  {
    spec: { kind: 'linear', domain: [-50, 50], range: [0, 500] },
    nice: [-50, 50],
    ticks: [-40, -20, 0, 20, 40],
    at: [0, 500, 250],
  },
  {
    spec: { kind: 'symlog', constant: 1, domain: [-50, 50], range: [0, 500] },
    nice: [-50, 50],
    ticks: [-40, -20, 0, 20, 40],
    at: [0, 500, 250],
  },
  {
    spec: {
      kind: 'symlog',
      constant: 0.01,
      domain: [-50, 50],
      range: [0, 500],
    },
    nice: [-50, 50],
    ticks: [-40, -20, 0, 20, 40],
    at: [0, 500, 250],
  },
  {
    spec: { kind: 'linear', domain: [0.001, 0.1], range: [0, 500] },
    nice: [0, 0.1],
    ticks: [0.02, 0.04, 0.06, 0.08, 0.1],
    at: [0, 500, 250],
  },
  {
    spec: {
      kind: 'symlog',
      constant: 1,
      domain: [0.001, 0.1],
      range: [0, 500],
    },
    nice: [0, 0.1],
    ticks: [0.02, 0.04, 0.06, 0.08, 0.1],
    at: [0, 500, -5.298977478941376],
  },
  {
    spec: {
      kind: 'symlog',
      constant: 0.01,
      domain: [0.001, 0.1],
      range: [0, 500],
    },
    nice: [0, 0.1],
    ticks: [0.02, 0.04, 0.06, 0.08, 0.1],
    at: [0, 500, -20.696342579112518],
  },
  {
    spec: { kind: 'linear', domain: [5, 5], range: [0, 500] },
    nice: [5, 5],
    ticks: [5],
    at: [250, 250, 250],
  },
  {
    spec: { kind: 'symlog', constant: 1, domain: [5, 5], range: [0, 500] },
    nice: [5, 5],
    ticks: [5],
    at: [250, 250, 250],
  },
  {
    spec: { kind: 'symlog', constant: 0.01, domain: [5, 5], range: [0, 500] },
    nice: [5, 5],
    ticks: [5],
    at: [250, 250, 250],
  },
  {
    spec: { kind: 'linear', domain: [100, 0], range: [0, 500] },
    nice: [100, 0],
    ticks: [100, 80, 60, 40, 20, 0],
    at: [0, 500, 250],
  },
  {
    spec: { kind: 'symlog', constant: 1, domain: [100, 0], range: [0, 500] },
    nice: [100, 0],
    ticks: [100, 80, 60, 40, 20, 0],
    at: [0, 500, 500],
  },
  {
    spec: { kind: 'symlog', constant: 0.01, domain: [100, 0], range: [0, 500] },
    nice: [100, 0],
    ticks: [100, 80, 60, 40, 20, 0],
    at: [0, 500, 500],
  },
  {
    spec: { kind: 'linear', domain: [0, 1000000], range: [0, 500] },
    nice: [0, 1000000],
    ticks: [0, 200000, 400000, 600000, 800000, 1000000],
    at: [0, 500, 250],
  },
  {
    spec: {
      kind: 'symlog',
      constant: 1,
      domain: [0, 1000000],
      range: [0, 500],
    },
    nice: [0, 1000000],
    ticks: [0, 200000, 400000, 600000, 800000, 1000000],
    at: [0, 500, 0],
  },
  {
    spec: {
      kind: 'symlog',
      constant: 0.01,
      domain: [0, 1000000],
      range: [0, 500],
    },
    nice: [0, 1000000],
    ticks: [0, 200000, 400000, 600000, 800000, 1000000],
    at: [0, 500, 0],
  },
  {
    spec: { kind: 'linear', domain: [-3.7, 42.9], range: [0, 500] },
    nice: [-5, 45],
    ticks: [0, 10, 20, 30, 40],
    at: [0, 500, 249.99999999999997],
  },
  {
    spec: {
      kind: 'symlog',
      constant: 1,
      domain: [-3.7, 42.9],
      range: [0, 500],
    },
    nice: [-5, 45],
    ticks: [0, 10, 20, 30, 40],
    at: [0, 500, 145.18897055279038],
  },
  {
    spec: {
      kind: 'symlog',
      constant: 0.01,
      domain: [-3.7, 42.9],
      range: [0, 500],
    },
    nice: [-5, 45],
    ticks: [0, 10, 20, 30, 40],
    at: [0, 500, 207.14301075024488],
  },
  {
    spec: { kind: 'log', base: 2, domain: [1, 1000], range: [0, 500] },
    nice: [1, 1024],
    ticks: [1, 4, 16, 64, 256],
    at: [0, 500, 449.9006803025562],
  },
  {
    spec: { kind: 'log', base: 10, domain: [1, 1000], range: [0, 500] },
    nice: [1, 1000],
    ticks: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200,
      300, 400, 500, 600, 700, 800, 900, 1000,
    ],
    at: [0, 500, 449.9006803025563],
  },
  {
    spec: { kind: 'log', base: 2, domain: [1, 2], range: [0, 500] },
    nice: [1, 2],
    ticks: [1, 1.2, 1.4, 1.6, 1.8, 2],
    at: [0, 500, 292.4812503605781],
  },
  {
    spec: { kind: 'log', base: 10, domain: [1, 2], range: [0, 500] },
    nice: [1, 10],
    ticks: [1, 1.2, 1.4, 1.6, 1.8, 2],
    at: [0, 500, 292.4812503605781],
  },
  {
    spec: { kind: 'log', base: 2, domain: [0.5, 5000], range: [0, 500] },
    nice: [0.5, 8192],
    ticks: [1, 4, 16, 64, 256, 1024, 4096],
    at: [0, 500, 462.37667895161024],
  },
  {
    spec: { kind: 'log', base: 10, domain: [0.5, 5000], range: [0, 500] },
    nice: [0.1, 10000],
    ticks: [
      0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50,
      60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000,
      3000, 4000, 5000,
    ],
    at: [0, 500, 462.3766789516102],
  },
  {
    spec: { kind: 'log', base: 2, domain: [-100, -1], range: [0, 500] },
    nice: [NaN, NaN],
    ticks: [],
    at: [0, 500, 74.17715547033468],
  },
  {
    spec: { kind: 'log', base: 10, domain: [-100, -1], range: [0, 500] },
    nice: [NaN, NaN],
    ticks: [],
    at: [0, 500, 74.17715547033468],
  },
  {
    spec: { kind: 'log', base: 2, domain: [1, 10], range: [0, 500] },
    nice: [1, 16],
    ticks: [1, 2, 4, 8],
    at: [0, 500, 370.18134474712195],
  },
  {
    spec: { kind: 'log', base: 10, domain: [1, 10], range: [0, 500] },
    nice: [1, 10],
    ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    at: [0, 500, 370.18134474712195],
  },
  {
    spec: { kind: 'log', base: 2, domain: [2, 3], range: [0, 500] },
    nice: [2, 4],
    ticks: [2, 2.2, 2.4, 2.6, 2.8, 3],
    at: [0, 500, 275.1698566066043],
  },
  {
    spec: { kind: 'log', base: 10, domain: [2, 3], range: [0, 500] },
    nice: [1, 10],
    ticks: [2, 2.2, 2.4, 2.6, 2.8, 3],
    at: [0, 500, 275.1698566066042],
  },
]

test.each(CASES)(
  '$spec.kind $spec.domain parity',
  ({ spec, nice, ticks, at }) => {
    expect(niceDomain(spec, 10)).toEqual(nice)
    expect(scaleTicks(spec, 5)).toEqual(ticks)
    const [d0, d1] = spec.domain
    const probes =
      spec.kind === 'symlog' ? [d0, d1, 0] : [d0, d1, (d0 + d1) / 2]
    expect(probes.map(x => scaleValue(spec, x))).toEqual(at)
  },
)
