import { scoreToY, yToScore } from './manhattanRenderingBackendTypes.ts'
import { scoreToYPx } from './shaders/manhattan.js.generated.ts'

// The retirement gate for manhattan.slang's `//! js-export` (adr-051).
//
// `retiredScoreToY` is the body `manhattanRenderingBackendTypes.ts` carried.
// It matters more than most twins because it is not only the draw: the hover
// hit-test runs the same function, so a Canvas2D-vs-GPU drift would put the
// grab target off the drawn point on the no-GPU path alone — the path that has
// no crossBackendGate coverage.
//
// The two spelled the degenerate-domain guard differently — `|| 1` here,
// `max(range, 1e-6)` in the shader — and probing that is what this sweep was
// built for. It found the guards are not equivalent: see the degenerate-domain
// test below, which is a Canvas2D behavior *fix*, not a retirement.

function retiredScoreToY(
  score: number,
  domainY: [number, number],
  canvasHeight: number,
) {
  const [domainMin, domainMax] = domainY
  const range = domainMax - domainMin || 1
  const norm = Math.max(0, Math.min(1, (score - domainMin) / range))
  return (1 - norm) * canvasHeight
}

// -log10 p is the conventional GWAS score, so the domains are small positive
// spans. An inverted domain is not in the set because `getNiceDomain` is fed
// `[scoreMin, scoreMax]` and cannot produce one.
const DOMAINS: [number, number][] = [
  [0, 10],
  [0, 1],
  [2, 8],
  [-3, 3],
]
const SCORES = [-100, -1, 0, 0.5, 2, 5, 7.5, 8, 10, 1e6]
const HEIGHTS = [1, 100, 337]

test('the generated scoreToYPx reproduces the hand-written twin it replaced', () => {
  for (const domain of DOMAINS) {
    for (const score of SCORES) {
      for (const h of HEIGHTS) {
        expect(scoreToYPx(score, domain[0], domain[1], h)).toBeCloseTo(
          retiredScoreToY(score, domain, h),
          9,
        )
      }
    }
  }
})

test('a pinned degenerate domain puts everything above it off the top', () => {
  // The one place the twins genuinely disagreed, and the reason to prefer the
  // shader's. A degenerate domain needs both `minScore` and `maxScore` config
  // bounds pinned to the same value (getNiceDomain does not otherwise collapse
  // a linear domain), which is exactly the case where "above the max" should
  // mean the top edge. `|| 1` instead invented a unit-wide domain, so a score
  // 0.5 above the pin drew half-way up the Canvas2D canvas while the GPU had it
  // at the top — a backend disagreement, on the path SVG export takes.
  expect(retiredScoreToY(0.5, [0, 0], 100)).toBe(50)
  expect(scoreToY(0.5, [0, 0], 100)).toBe(0)

  expect(scoreToY(5, [5, 5], 100)).toBe(100)
  expect(scoreToY(4, [5, 5], 100)).toBe(100)
  expect(scoreToY(6, [5, 5], 100)).toBe(0)
  expect(Number.isNaN(scoreToY(5, [0, 0], 100))).toBe(false)
})

test('out-of-domain scores clamp to the edges instead of drawing off-canvas', () => {
  expect(scoreToY(-100, [0, 10], 200)).toBe(200)
  expect(scoreToY(1e6, [0, 10], 200)).toBe(0)
})

test('bigger score is higher on screen', () => {
  expect(scoreToY(0, [0, 10], 100)).toBe(100)
  expect(scoreToY(5, [0, 10], 100)).toBe(50)
  expect(scoreToY(10, [0, 10], 100)).toBe(0)
})

test('yToScore still inverts the generated forward map', () => {
  // The hit-test window depends on this pairing, and the forward half now comes
  // from the shader while the inverse stays hand-written. Anywhere the domain
  // has a span — i.e. anywhere the inverse means anything — they must agree.
  for (const domain of DOMAINS.filter(d => d[1] > d[0])) {
    for (const score of [domain[0], (domain[0] + domain[1]) / 2, domain[1]]) {
      expect(yToScore(scoreToY(score, domain, 200), domain, 200)).toBeCloseTo(
        score,
        9,
      )
    }
  }
})
