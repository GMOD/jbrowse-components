import { HEAD_HALF_H_PX } from './arrow.consts.generated.ts'
import { arrowCoverage, arrowReachPx } from './arrow.js.generated.ts'

// At one sample a fragment draws only if its centre is inside the quad, so ink
// the coverage puts past `arrowReachPx` is cut off. The head's tip is the
// sharpest corner and reaches furthest.
//
// Coverage is a product of clamped ramps that only fall moving away from the
// quad, so a leak shows first on the quad's edge, where the head's corners
// reach it over a sliver: the edges are walked finely just outside, and bands
// further out coarsely.
const JUST_PAST = 1e-6
const PAST_EDGE = [
  1e-3, 0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.65, 0.8,
  1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6,
]

function range(from: number, to: number, step: number) {
  return Array.from(
    { length: Math.ceil((to - from) / step) },
    (_, k) => from + k * step,
  )
}

test.each(
  [1, 1.5, 2].flatMap(dpr =>
    [HEAD_HALF_H_PX, 1, 0.5, 0].map(headHalf => [dpr, headHalf]),
  ),
)('at dpr %s the quad holds a head %s px tall', (dpr, headHalf) => {
  const [tip, halfH] = arrowReachPx(headHalf, dpr)
  const leaks: [number, number][] = []
  const probe = (along: number, across: number) => {
    if (arrowCoverage(along, across, headHalf, dpr) > 0) {
      leaks.push([along, across])
    }
  }
  const walk = (d: number, step: number) => {
    for (const across of range(-halfH - 3, halfH + 3, step)) {
      probe(tip + d, across)
    }
    for (const along of range(-2, tip + 6, step)) {
      probe(along, halfH + d)
      probe(along, -halfH - d)
    }
  }
  walk(JUST_PAST, 0.001)
  for (const d of PAST_EDGE) {
    walk(d, 0.01)
  }
  expect(leaks.slice(0, 3)).toEqual([])
})
