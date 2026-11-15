import { placeRectCapped } from '../RenderAlignmentDataRPC/sortLayout.ts'
import { computeMultiRegionChainLayout } from './computeChainLayout.ts'

interface Chain {
  name: string
  lo: number
  hi: number
  distance: number
}

const REGION_STRIDE = 2 ** 33
function screenOrderOf(
  reversed: boolean | undefined,
  regionIndex: number,
  bp: number,
) {
  return regionIndex * REGION_STRIDE + (reversed ? -bp : bp)
}

function protoRows(
  entries: [number, Chain[]][],
  regions: Map<number, { refName: string; reversed?: boolean }>,
) {
  const merged = new Map<
    string,
    { minStart: number; maxEnd: number; distance: number; crosses: boolean }
  >()
  for (const [idx, chains] of entries) {
    const reversed = regions.get(idx)?.reversed
    for (const { name, lo, hi, distance } of chains) {
      const a = screenOrderOf(reversed, idx, lo)
      const b = screenOrderOf(reversed, idx, hi)
      const minStart = Math.min(a, b)
      const maxEnd = Math.max(a, b)
      const e = merged.get(name)
      if (e) {
        e.crosses = true
        e.minStart = Math.min(e.minStart, minStart)
        e.maxEnd = Math.max(e.maxEnd, maxEnd)
        e.distance = Math.max(e.distance, distance)
      } else {
        merged.set(name, { minStart, maxEnd, distance, crosses: false })
      }
    }
  }
  const packed = [...merged].map(([name, m]) => ({ name, ...m }))
  packed.sort(
    (a, b) =>
      Number(b.crosses) - Number(a.crosses) ||
      a.distance - b.distance ||
      a.minStart - b.minStart ||
      a.maxEnd - b.maxEnd ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )
  const rows: number[][] = []
  const rowMap = new Map<string, number>()
  for (const { name, minStart, maxEnd } of packed) {
    rowMap.set(name, placeRectCapped(rows, minStart, maxEnd, 65534))
  }
  return { rowMap, maxY: rows.length }
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function chainsOf(n: number, span: number, len: () => number, seed: number) {
  const rand = rng(seed)
  return Array.from({ length: n }, (_, i) => {
    const lo = Math.floor(rand() * span)
    const l = len()
    return { name: `c${i}`, lo, hi: lo + l, distance: l }
  })
}

function todayRows(chains: Chain[]) {
  const data = {
    readKeys: new Uint32Array(chains.length),
    readChainIndices: Uint32Array.from(chains.map((_, i) => i)),
    chainNames: chains.map(c => c.name),
    chainAbsMinStarts: Float64Array.from(chains.map(c => c.lo)),
    chainAbsMaxEnds: Float64Array.from(chains.map(c => c.hi)),
    chainDistances: Float64Array.from(chains.map(c => c.distance)),
  }
  return computeMultiRegionChainLayout(
    // @ts-expect-error probe-only partial data
    [[0, data]],
    new Map([[0, { refName: 'ctgA', start: 0, end: 5000 }]]),
  )
}

function moved(a: Map<string, number>, b: Map<string, number>) {
  let n = 0
  for (const [k, v] of a) {
    if (b.get(k) !== v) {
      n++
    }
  }
  return n
}

test('one region, forward against flipped', () => {
  const out: string[] = []
  for (const [label, len] of [
    ['fixed 150 bp', () => 150],
    ['mixed 100-400 bp', (r => () => 100 + Math.floor(r() * 300))(rng(7))],
  ] as const) {
    const chains = chainsOf(400, 2000, len, 42)
    const today = todayRows(chains)
    const fwd = protoRows(
      [[0, chains]],
      new Map([[0, { refName: 'ctgA' }]]),
    )
    const rev = protoRows(
      [[0, chains]],
      new Map([[0, { refName: 'ctgA', reversed: true }]]),
    )
    out.push(
      `${label}: today maxY ${today.maxY}; proto forward maxY ${fwd.maxY}, rows differing from today ${moved(today.rowMap, fwd.rowMap)}; proto flipped maxY ${rev.maxY}, chains on another row than forward ${moved(fwd.rowMap, rev.rowMap)} of ${chains.length}`,
    )
  }
  console.log(out.join('\n'))
  expect(out.length).toBe(2)
})
