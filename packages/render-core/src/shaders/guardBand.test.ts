import { guardBandClipX } from './hpmath.js.generated.ts'

// Float32 models of the drivers CI does not draw on, at farCorner.ts's scale:
// llvmpipe computes lerp exactly at its endpoints.
const f = Math.fround
const W = 225
const PX_PER_BP = 50
const VIEW_START = 50_000_000
const HI = Math.floor(VIEW_START / 4096) * 4096
const LO = VIEW_START - HI
const STEP = f(2 / f(W / PX_PER_BP))
const FAR_PX = [1e5, 1e6, 1e7, 1e8]
const NEAR_BP = [1, 2, 3, 4].map(k => VIEW_START + k)
const TOLERANCE_PX = 1e-3

function clipX(bp: number) {
  const lo = bp % 4096
  return f(f(f(f(f(bp - lo) - HI) * STEP) + f(f(f(lo) - LO) * STEP)) - 1)
}
const toPx = (clip: number) => (clip + 1) * (W / 2)
const guarded = (clip: number) => f(guardBandClipX(clip, W))
const unguarded = (clip: number) => clip

// lerp(a, b, t) as NVIDIA, SwiftShader, D3D12 and Metal compute it.
const lerpByDifference = (a: number, b: number, t: number) =>
  f(a + f(t * f(b - a)))

const lerpedCorner = (far: number, near: number) =>
  toPx(lerpByDifference(far, near, 1))

function startPlusLength(far: number, near: number) {
  const lengthPx = f(f(f(near - far) * W) * 0.5)
  return toPx(f(far + f(f(lengthPx / W) * 2)))
}

// Where a fragment half a pixel inside the near edge finds that edge, from an
// x varying the rasterizer interpolates between the two vertices.
function interpolatedEdge(far: number, near: number) {
  const x0 = f(toPx(far))
  const x1 = f(toPx(near))
  const x = x1 - 0.5
  const s = f(f(x - x0) / f(x1 - x0))
  const varying = f(f(x0 * f(1 - s)) + f(x1 * s))
  return x - (varying - x1)
}

function worstErrorPx(
  ends: (clip: number) => number,
  nearEdgePx: (far: number, near: number) => number,
) {
  return Math.max(
    ...FAR_PX.flatMap(farPx =>
      NEAR_BP.map(near => {
        const far = near - farPx / PX_PER_BP
        const want = (near - VIEW_START) * PX_PER_BP
        return Math.abs(nearEdgePx(ends(clipX(far)), ends(clipX(near))) - want)
      }),
    ),
  )
}

describe('guardBandClipX', () => {
  test.each([
    ['a quad corner lerped off the far end', lerpedCorner],
    ['an end built as the far end plus the length', startPlusLength],
    ['an edge read off an interpolated x', interpolatedEdge],
  ] as const)('%s lands on the near end', (_, nearEdgePx) => {
    expect(worstErrorPx(unguarded, nearEdgePx)).toBeGreaterThan(0.5)
    expect(worstErrorPx(guarded, nearEdgePx)).toBeLessThan(TOLERANCE_PX)
  })

  test('leaves a clip x on screen or just off it unchanged', () => {
    for (let i = 0; i <= 1000; i++) {
      const x = f(-2 + i / 250)
      expect(guarded(x)).toBe(x)
    }
  })
})
