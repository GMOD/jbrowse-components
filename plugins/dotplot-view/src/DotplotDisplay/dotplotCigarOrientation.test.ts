import { buildLineSegments } from './dotplotGeometry.ts'
import { fakeDotplotRpcData } from './testUtils.ts'

// Where a CIGAR's ops land along an alignment, which the endpoints alone cannot
// say. A PAF `cg` is written ANCHOR-FORWARD with the mate walking backward on
// the '-' strand, so op 0 sits at (anchor start, mate end) — while the worker
// hands geometry whose (p11, p21) corner is the anchor's END for those features,
// so that p11 -> p12 is the drawn direction. Walking from that corner traverses
// the same line and lands on the same endpoints, so every endpoint assertion in
// the suite still passed while each indel was laid down mirrored through the
// block's centre.
//
// The fixture is the same alignment from both PIF perspectives, which is what
// make-pif writes into the two tiers: `t` keeps the PAF cg verbatim, `q` gets
// `flipCigar` (op order reversed, I<->D swapped). Both must place the gap on the
// same pair of genomic intervals.

const M = (len: number) => (len << 4) | 0
const I = (len: number) => (len << 4) | 1
const D = (len: number) => (len << 4) | 2

// t 0..6000, q 0..1000, strand '-', cg=100M5000D900M. Walking target-forward
// from (t=0, q=1000): 100M -> (100, 900), then the deletion runs to t=5100 with
// the query held at 900, then 900M closes on (6000, 0).
const GAP_T: [number, number] = [100, 5100]
const GAP_Q = 900

function segments(data: ReturnType<typeof fakeDotplotRpcData>) {
  const segs = buildLineSegments(data, true, 0, 0, 1, 1, 0, 0)
  return Array.from({ length: segs.instanceCount }, (_, i) => ({
    op: segs.segmentOps[i]!,
    x: [segs.x1[i]!, segs.x2[i]!] as [number, number],
    y: [segs.y1[i]!, segs.y2[i]!] as [number, number],
  }))
}

const span = (a: number, b: number): [number, number] =>
  a < b ? [a, b] : [b, a]

test('a reverse-strand cg places its gap from the anchor START', () => {
  // the target perspective: h axis is the target, so the D advances h
  const segs = segments(
    fakeDotplotRpcData({
      p11: new Float64Array([6000]),
      p12: new Float64Array([0]),
      p21: new Float64Array([0]),
      p22: new Float64Array([1000]),
      strands: new Int8Array([-1]),
      alignmentLengths: new Uint32Array([6000]),
      cigarData: new Uint32Array([M(100), D(5000), M(900)]),
      cigarOffsets: new Uint32Array([0, 3]),
    }),
  )
  const gap = segs.find(s => s.op === 2)!
  expect(span(...gap.x)).toEqual(GAP_T)
  expect(gap.y).toEqual([GAP_Q, GAP_Q])
})

test('the same alignment from the query perspective places it identically', () => {
  // make-pif's `q` row: anchor and mate swap axes, and flipCigar reverses the op
  // order and turns the D into an I (which advances the mate, now the target)
  const segs = segments(
    fakeDotplotRpcData({
      p11: new Float64Array([1000]),
      p12: new Float64Array([0]),
      p21: new Float64Array([0]),
      p22: new Float64Array([6000]),
      strands: new Int8Array([-1]),
      alignmentLengths: new Uint32Array([1000]),
      cigarData: new Uint32Array([M(900), I(5000), M(100)]),
      cigarOffsets: new Uint32Array([0, 3]),
    }),
  )
  const gap = segs.find(s => s.op === 1)!
  expect(gap.x).toEqual([GAP_Q, GAP_Q])
  expect(span(...gap.y)).toEqual(GAP_T)
})

test('a reversed v region mirrors the gap with the axis, not against it', () => {
  // auto-diagonalize flips query regions, so the v axis lays out top-down: the
  // mate's cumBp runs backwards and p21 > p22. The gap must stay on the same
  // BASES, which on this axis is 20000 - q.
  const segs = segments(
    fakeDotplotRpcData({
      p11: new Float64Array([6000]),
      p12: new Float64Array([0]),
      p21: new Float64Array([20000]),
      p22: new Float64Array([19000]),
      strands: new Int8Array([-1]),
      alignmentLengths: new Uint32Array([6000]),
      cigarData: new Uint32Array([M(100), D(5000), M(900)]),
      cigarOffsets: new Uint32Array([0, 3]),
    }),
  )
  const gap = segs.find(s => s.op === 2)!
  expect(span(...gap.x)).toEqual(GAP_T)
  expect(gap.y).toEqual([20000 - GAP_Q, 20000 - GAP_Q])
})

test('a forward-strand cg is unchanged: it starts at the (p11, p21) corner', () => {
  const segs = segments(
    fakeDotplotRpcData({
      p11: new Float64Array([0]),
      p12: new Float64Array([6000]),
      p21: new Float64Array([0]),
      p22: new Float64Array([1000]),
      strands: new Int8Array([1]),
      alignmentLengths: new Uint32Array([6000]),
      cigarData: new Uint32Array([M(100), D(5000), M(900)]),
      cigarOffsets: new Uint32Array([0, 3]),
    }),
  )
  const gap = segs.find(s => s.op === 2)!
  expect(span(...gap.x)).toEqual(GAP_T)
  expect(gap.y).toEqual([100, 100])
})
