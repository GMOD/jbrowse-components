import { HEAD_HALF_H_PX } from './arrow.consts.generated.ts'
import { arrowCoverage, arrowReachPx } from './arrow.js.generated.ts'

// At one sample a fragment draws only if its centre is inside the quad, so ink
// the coverage puts past `arrowReachPx` is cut off. The head's tip is the
// sharpest corner and reaches furthest.
test.each(
  [1, 1.5, 2].flatMap(dpr =>
    [HEAD_HALF_H_PX, 1, 0.5, 0].map(headHalf => [dpr, headHalf]),
  ),
)('at dpr %s the quad holds a head %s px tall', (dpr, headHalf) => {
  const [tip, halfH] = arrowReachPx(headHalf, dpr)
  let outside = 0
  for (let along = -2; along < tip + 6; along += 0.01) {
    for (let across = -halfH - 3; across < halfH + 3; across += 0.01) {
      if (along > tip || Math.abs(across) > halfH) {
        outside = Math.max(outside, arrowCoverage(along, across, headHalf, dpr))
      }
    }
  }
  expect(outside).toBe(0)
})
