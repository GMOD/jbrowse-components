import { valueToYPxScaled } from '@jbrowse/render-core/shaders/pointMark'

// The retirement gate for pointMark.slang's `//! js-export` (adr-051).
//
// `retiredScoreToY` is the body `manhattanRenderingBackendTypes.ts` carried
// before Manhattan drew through the `point` shape, whose linear scale is the
// generated `valueToYPxScaled`. The two spelled the degenerate-domain guard
// differently — `|| 1` here, a step in the shader — and the degenerate-domain
// test below is the Canvas2D behavior fix that probe found, not a retirement.

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

function scoreToY(
  score: number,
  [min, max]: [number, number],
  canvasHeight: number,
) {
  return valueToYPxScaled(score, min, max, canvasHeight, 0, 1)
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

test('the generated linear scale reproduces the hand-written twin it replaced', () => {
  for (const domain of DOMAINS) {
    for (const score of SCORES) {
      for (const h of HEIGHTS) {
        expect(scoreToY(score, domain, h)).toBeCloseTo(
          retiredScoreToY(score, domain, h),
          9,
        )
      }
    }
  }
})

test('a pinned degenerate domain puts everything above it off the top', () => {
  // A degenerate domain needs both `minScore` and `maxScore` config bounds
  // pinned to the same value, which is exactly the case where "above the max"
  // should mean the top edge. `|| 1` instead invented a unit-wide domain, so a
  // score 0.5 above the pin drew half-way up the Canvas2D canvas while the GPU
  // had it at the top — on the path SVG export takes.
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
