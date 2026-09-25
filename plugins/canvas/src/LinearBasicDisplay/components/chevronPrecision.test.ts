import {
  chevronCount,
  chevronOffset,
} from '../passes/shaders/chevron.js.generated.ts'

// A model of the float32 arithmetic chevron.slang runs between `chevronOffset`
// and clip x. `hpmath`'s split is `js-skip`ped — the Canvas2D twin has float64
// and needs none — so there is no generated twin to drive, and this stands in
// for one: `Math.fround` after every operation is what a GPU does between
// registers. The offset itself comes from the shader's own transliterated
// function, so only the hp arithmetic is modelled here.
const f = Math.fround
const HP_LOW_SPAN = 4096

// `chevronOffset` with a rounding after each operation, which is what the
// shader runs. Driving the transliterated twin directly would run the same
// formula in float64 and see none of what this file measures; the test below
// holds the two to one formula.
function chevronOffsetF32(span: number, count: number, index: number) {
  return f(f(span / f(count + 1)) * f(index + 1))
}

function hpSplitUint(value: number) {
  const lo = value & 0xfff
  return [f(value - lo), f(lo)] as const
}

function hpToClipX(split: readonly [number, number], bpRange: number[]) {
  const step = f(2 / bpRange[2]!)
  const hi = f(split[0] - bpRange[0]!)
  const lo = f(split[1] - bpRange[1]!)
  return f(f(-1 + f(hi * step)) + f(lo * step))
}

// The lane the offset lands in: `lo` is what the shader did before the split
// was restored, `hi` is `hpAddBp`.
function chevronClipX(
  startBp: number,
  lengthBp: number,
  index: number,
  viewStartBp: number,
  canvasWidthPx: number,
  bpPerPx: number,
  lane: 'hi' | 'lo',
) {
  const count = chevronCount(f(f(lengthBp) / bpPerPx))
  const offsetBp = chevronOffsetF32(f(lengthBp), count, index)
  const line = hpSplitUint(startBp)
  const view = hpSplitUint(viewStartBp)
  const bpRange = [view[0], view[1], f(canvasWidthPx * bpPerPx)]
  const split =
    lane === 'hi'
      ? ([
          f(line[0] + f(Math.floor(f(offsetBp / HP_LOW_SPAN)) * HP_LOW_SPAN)),
          f(
            line[1] +
              f(
                offsetBp -
                  f(Math.floor(f(offsetBp / HP_LOW_SPAN)) * HP_LOW_SPAN),
              ),
          ),
        ] as const)
      : ([line[0], f(line[1] + offsetBp)] as const)
  return f((hpToClipX(split, bpRange) + 1) * 0.5 * canvasWidthPx)
}

// What the Canvas2D painter puts the same chevron at, in float64 — `drawLines`
// measures the line in px off `makeBpMapper` and never meets a 24-bit mantissa.
function canvas2dPx(
  startBp: number,
  lengthBp: number,
  index: number,
  viewStartBp: number,
  bpPerPx: number,
) {
  const widthPx = lengthBp / bpPerPx
  const count = chevronCount(f(f(lengthBp) / bpPerPx))
  return (
    (startBp - viewStartBp) / bpPerPx + chevronOffset(widthPx, count, index)
  )
}

const CANVAS_PX = 1920

function worstDriftPx(
  startBp: number,
  lengthBp: number,
  bpPerPx: number,
  lane: 'hi' | 'lo',
) {
  const count = chevronCount(f(f(lengthBp) / bpPerPx))
  let worst = 0
  for (let s = 0; s < 400; s++) {
    const index = Math.floor((count * s) / 400)
    const at = startBp + (lengthBp / (count + 1)) * (index + 1)
    const viewStart = Math.max(0, Math.floor(at - (CANVAS_PX * bpPerPx) / 2))
    const drift = Math.abs(
      chevronClipX(
        startBp,
        lengthBp,
        index,
        viewStart,
        CANVAS_PX,
        bpPerPx,
        lane,
      ) - canvas2dPx(startBp, lengthBp, index, viewStart, bpPerPx),
    )
    worst = Math.max(worst, drift)
  }
  return worst
}

// A long intron at deep zoom is the case: the offset is genomic-magnitude while
// one bp is 50 px, so the lane it lands in decides whether the chevrons sit
// where the Canvas2D and SVG paths draw them.
const DEEP = [
  { name: '250 kb intron at 0.02 bp/px', lengthBp: 250_000, bpPerPx: 0.02 },
  { name: '1 Mb intron at 0.02 bp/px', lengthBp: 1_000_000, bpPerPx: 0.02 },
  { name: '2 Mb intron at 0.05 bp/px', lengthBp: 2_000_000, bpPerPx: 0.05 },
]

test('the float32 model runs the same formula the twin does', () => {
  for (const span of [5_000, 250_000, 1_000_000]) {
    const count = chevronCount(span / 0.02 / 1)
    for (const index of [0, 1, Math.floor(count / 2), count - 1]) {
      const exact = chevronOffset(span, count, index)
      expect(chevronOffsetF32(span, count, index)).toBeCloseTo(exact, 1)
    }
  }
})

test('the lo lane alone drifts the far chevrons off the Canvas2D twin', () => {
  // The sabotage: this is the form the shader had, and it must fail the bound
  // the split form meets.
  for (const { lengthBp, bpPerPx } of DEEP) {
    expect(worstDriftPx(1_000_000, lengthBp, bpPerPx, 'lo')).toBeGreaterThan(1)
  }
})

test('splitting the offset across both lanes more than halves that drift', () => {
  for (const { lengthBp, bpPerPx } of DEEP) {
    const lo = worstDriftPx(1_000_000, lengthBp, bpPerPx, 'lo')
    const hi = worstDriftPx(1_000_000, lengthBp, bpPerPx, 'hi')
    expect(hi).toBeLessThan(lo / 2)
  }
})

test('and it does not close it: the offset is rounded before either lane', () => {
  // `chevronOffset` is one float32 of genomic magnitude, so a 1 Mb intron's far
  // chevrons still land over a px from the twin. Closing that needs compensated
  // arithmetic for `span * (i + 1) / (n + 1)`, not a wider split.
  expect(worstDriftPx(1_000_000, 1_000_000, 0.02, 'hi')).toBeGreaterThan(1)
})

test('a genomic offset in the lo lane is what the split exists to prevent', () => {
  // Same drift at a chromosome-scale start: the split's whole job is that the
  // magnitude of the coordinate does not reach the arithmetic.
  for (const startBp of [1_000_000, 150_000_000]) {
    expect(worstDriftPx(startBp, 250_000, 0.02, 'hi')).toBeLessThan(
      worstDriftPx(startBp, 250_000, 0.02, 'lo') / 2,
    )
  }
})

test('an ordinary intron at an ordinary zoom is unmoved either way', () => {
  for (const bpPerPx of [1, 10]) {
    expect(worstDriftPx(1_000_000, 20_000, bpPerPx, 'hi')).toBeLessThan(0.01)
    expect(worstDriftPx(1_000_000, 20_000, bpPerPx, 'lo')).toBeLessThan(0.01)
  }
})
