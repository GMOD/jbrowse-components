import {
  chordTurn,
  polarPoint,
  ribbonReturnTurn,
  turnControlPoint,
} from './shaders/chordStage.js.generated.ts'
import { RIBBON_BAND_SEGMENTS } from './shaders/ribbon.consts.generated.ts'
import { pinchedParam } from './shaders/ribbon.js.generated.ts'

import type { RibbonAngles } from './chordStage.ts'

type Vec = readonly [number, number]

const N = RIBBON_BAND_SEGMENTS
const PAD = 0.5

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]]
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]]
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k]
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1]
const cross = (a: Vec, b: Vec) => a[0] * b[1] - a[1] * b[0]
const len = (a: Vec) => Math.hypot(a[0], a[1])

const quadBezier = (p0: Vec, c: Vec, p1: Vec, t: number) =>
  add(
    add(scale(p0, (1 - t) * (1 - t)), scale(c, 2 * (1 - t) * t)),
    scale(p1, t * t),
  )
const quadBezierTangent = (p0: Vec, c: Vec, p1: Vec, t: number) =>
  add(scale(sub(c, p0), 2 * (1 - t)), scale(sub(p1, c), 2 * t))

// ribbon.slang's band vertices, step for step, so the strip's triangles can be
// checked for the overlap a translucent ribbon would blend twice
function bandStrip({ a1, a2, m1, m2 }: RibbonAngles, r: number, br: number) {
  const outTurn = chordTurn(a2, m1)
  const p0 = polarPoint(r, a2)
  const c0 = turnControlPoint(a2, outTurn, r, br)
  const p1 = polarPoint(r, m1)
  const q0 = polarPoint(r, m2)
  const c1 = turnControlPoint(m2, ribbonReturnTurn(outTurn, m2, a1), r, br)
  const q1 = polarPoint(r, a1)
  const first = (t: number) => quadBezier(p0, c0, p1, t)
  const second = (t: number) => quadBezier(q0, c1, q1, 1 - t)
  const firstTangent = (t: number) => quadBezierTangent(p0, c0, p1, t)
  const secondTangent = (t: number) => quadBezierTangent(q0, c1, q1, 1 - t)
  const bandNormal = (tl: number, tq: number): Vec => {
    const dl = firstTangent(tl)
    const dq = scale(secondTangent(tq), -1)
    const ul = scale(dl, 1 / Math.max(len(dl), 1e-6))
    const sum = add(ul, scale(dq, 1 / Math.max(len(dq), 1e-6)))
    const along = len(sum) > 1e-3 ? scale(sum, 1 / len(sum)) : ul
    return [-along[1], along[0]]
  }
  const widthAt = (t: number) => dot(sub(second(t), first(t)), bandNormal(t, t))

  function curvesCross(): Vec | undefined {
    const startNegative = widthAt(0) < 0
    if (startNegative === widthAt(1) < 0) {
      return undefined
    }
    let lo = 0
    let hi = 1
    for (let k = 0; k < 8; k++) {
      const mid = 0.5 * (lo + hi)
      if (widthAt(mid) < 0 === startNegative) {
        lo = mid
      } else {
        hi = mid
      }
    }
    let at: Vec = [0.5 * (lo + hi), 0.5 * (lo + hi)]
    for (let k = 0; k < 4; k++) {
      const f = sub(first(at[0]), second(at[1]))
      const dl = firstTangent(at[0])
      const dq = secondTangent(at[1])
      const det = cross(dl, dq)
      if (Math.abs(det) > 1e-6) {
        const step: Vec = [-cross(f, dq) / det, -cross(dl, f) / det]
        at = [
          Math.min(Math.max(at[0] + step[0], 0), 1),
          Math.min(Math.max(at[1] + step[1], 0), 1),
        ]
      }
    }
    return len(sub(first(at[0]), second(at[1]))) < 0.25 ? at : undefined
  }

  const at = curvesCross()
  const verts: Vec[] = []
  for (let k = 0; k <= N; k++) {
    const s = k / N
    let tl = s
    let tq = s
    if (at) {
      const pinch = Math.min(
        Math.max(Math.floor(N * (at[0] + at[1]) * 0.5 + 0.5), 1),
        N - 1,
      )
      if (k === pinch) {
        const x = scale(add(first(at[0]), second(at[1])), 0.5)
        verts.push(x, x)
        continue
      }
      tl = pinchedParam(s, pinch / N, at[0])
      tq = pinchedParam(s, pinch / N, at[1])
    }
    const l = first(tl)
    const q = second(tq)
    let dir = bandNormal(tl, tq)
    if (dot(sub(q, l), dir) < 0) {
      dir = scale(dir, -1)
    }
    const x = at ? first(at[0]) : undefined
    const padL = x ? Math.min(PAD, len(sub(l, x))) : PAD
    const padQ = x ? Math.min(PAD, len(sub(q, x))) : PAD
    verts.push(sub(l, scale(dir, padL)), add(q, scale(dir, padQ)))
  }
  return { verts, crossing: at && first(at[0]) }
}

const polygonArea = (p: readonly Vec[]) =>
  p.reduce((s, a, i) => s + cross(a, p[(i + 1) % p.length]!), 0) / 2

function clipConvex(subject: readonly Vec[], clipper: readonly Vec[]) {
  let out = subject
  for (let i = 0; i < clipper.length && out.length > 0; i++) {
    const a = clipper[i]!
    const edge = sub(clipper[(i + 1) % clipper.length]!, a)
    const input = out
    out = []
    for (let j = 0; j < input.length; j++) {
      const p = input[j]!
      const q = input[(j + 1) % input.length]!
      const dp = cross(edge, sub(p, a))
      const dq = cross(edge, sub(q, a))
      if (dp >= 0) {
        out.push(p)
      }
      if (dp >= 0 !== dq >= 0) {
        out.push(add(p, scale(sub(q, p), dp / (dp - dq))))
      }
    }
  }
  return out
}

// px² the strip's triangles cover more than once; a strip that never folds
// has its neighbours meet only along their shared edges
function overlapArea(verts: readonly Vec[]) {
  const tris: Vec[][] = []
  for (let i = 0; i + 2 < verts.length; i++) {
    const [a, b, c] = [verts[i]!, verts[i + 1]!, verts[i + 2]!]
    const area = cross(sub(b, a), sub(c, a))
    if (Math.abs(area) > 1e-9) {
      tris.push(area > 0 ? [a, b, c] : [a, c, b])
    }
  }
  let total = 0
  for (let i = 0; i < tris.length; i++) {
    for (let j = i + 1; j < tris.length; j++) {
      const shared = clipConvex(tris[i]!, tris[j]!)
      if (shared.length > 2) {
        total += Math.abs(polygonArea(shared))
      }
    }
  }
  return total
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TWISTED: [string, RibbonAngles, number, number][] = [
  ['ends of one width', { a1: 0, a2: 0.15, m1: 2.65, m2: 2.5 }, 400, 0],
  ['ends of different widths', { a1: 0, a2: 0.4, m1: 2.05, m2: 2 }, 300, 30],
  ['a short reach', { a1: 0, a2: 0.3, m1: 1.5, m2: 1.2 }, 200, 20],
  [
    'antipodal ends',
    { a1: -0.3, a2: 0.3, m1: Math.PI + 0.3, m2: Math.PI - 0.3 },
    200,
    20,
  ],
  [
    'abutting ends',
    { a1: -0.959, a2: -1.4188, m1: -1.624, m2: -1.4194 },
    200,
    20,
  ],
]

test.each(TWISTED)(
  'a twisted ribbon with %s pinches at its crossing and covers each pixel once',
  (_, angles, r, br) => {
    const { verts, crossing } = bandStrip(angles, r, br)
    expect(overlapArea(verts)).toBeLessThan(1e-3)
    expect(crossing).toBeDefined()
    expect(verts).toContainEqual(crossing!.map(v => expect.closeTo(v, 1)))
  },
)

test('an untwisted ribbon keeps its band as it was', () => {
  const angles = { a1: 0, a2: 0.15, m1: 2.5, m2: 2.65 }
  const { verts, crossing } = bandStrip(angles, 400, 0)
  expect(crossing).toBeUndefined()
  expect(overlapArea(verts)).toBeLessThan(1e-3)
})

// ends apart on the circle; a ribbon whose two ends overlap folds for a
// reason of its own
test('no twisted ribbon between two separate spans folds', () => {
  const rand = mulberry32(11)
  const onArc = (x: number, from: number, to: number) => {
    const lo = Math.min(from, to)
    const d = (((x - lo) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    return d <= Math.abs(to - from)
  }
  let twisted = 0
  for (let i = 0; i < 300; i++) {
    const span = () => (0.005 + rand() * 0.6) * (rand() < 0.5 ? 1 : -1)
    const a1 = rand() * 2 * Math.PI - Math.PI
    const a2 = a1 + span()
    const m1 = rand() * 2 * Math.PI - Math.PI
    const m2 = m1 + span()
    if (
      onArc(m1, a1, a2) ||
      onArc(m2, a1, a2) ||
      onArc(a1, m1, m2) ||
      onArc(a2, m1, m2)
    ) {
      continue
    }
    const [r, br] = i % 2 ? [200, 20] : [400, 0]
    const { verts, crossing } = bandStrip({ a1, a2, m1, m2 }, r, br)
    if (crossing) {
      twisted++
    }
    expect([i, overlapArea(verts)]).toEqual([i, expect.closeTo(0, 2)])
  }
  expect(twisted).toBeGreaterThan(100)
})
