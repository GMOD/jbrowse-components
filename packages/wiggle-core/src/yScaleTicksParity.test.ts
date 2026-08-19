import { computeYTicks } from './computeYTicks.ts'
import {
  makeScoreNormalizer,
  resolveSymlogConstant,
  scaleTypeFromString,
} from './normalize.ts'
import { getNiceDomain } from './scale.ts'
import {
  axisPlotBox,
  clampStrokeInsideAxis,
  scoreToAxisY,
} from './yScaleTicks.ts'

// The invariant `YScaleTicks` documents, over the pair that broke it: the axis
// (`computeYTicks`, d3 through `getScale`) and the renderer (`axisPlotBox` +
// `makeScoreNormalizer`, what the GPU and Canvas2D backends and the SVG export
// all place their plot with) must agree on where a value lands.
//
// A unit test of `computeYTicks` alone would not have caught either bug it had:
// its output was self-consistent both times, and wrong only against the pixels.
// Nothing here re-implements the mapping — both sides are the shipped ones.
//
// `computeInsertSizeTicks` states the same rule for the read-cloud arcs, and
// keeps it by deriving from `arcYScale`'s own functions; `computeCoverageTicks`
// by computing its ticks off the bottom the coverage draws use.

const noBounds: [undefined, undefined] = [undefined, undefined]

// Every wiggle-family domain reaches both sides through getNiceDomain, so nice
// it here too rather than testing a domain the app can't produce.
function niced(scaleType: string, domain: [number, number]) {
  return getNiceDomain({ scaleType, domain, bounds: noBounds })
}

const CASES = [
  { name: 'linear', scaleType: 'linear', raw: [0, 1000], height: 200 },
  {
    name: 'linear, negative scores',
    scaleType: 'linear',
    raw: [-40, 60],
    height: 200,
  },
  { name: 'log', scaleType: 'log', raw: [1, 1000], height: 200 },
  // the regression: getNiceDomain deliberately keeps a log domain under 1
  // (mappability, methylation fraction, any normalized ratio) rather than
  // pinning min to 1, and the normalizer used to floor at 1 anyway
  {
    name: 'log entirely under 1',
    scaleType: 'log',
    raw: [0.01, 0.5],
    height: 200,
  },
  {
    name: 'log under 1, deep',
    scaleType: 'log',
    raw: [0.00001, 0.02],
    height: 200,
  },
  // symlog's reason to exist: a domain that reaches 0, and one that crosses it.
  // scaleLog cannot hold either, so neither appears above.
  {
    name: 'symlog reaching zero',
    scaleType: 'symlog',
    raw: [0, 1000],
    height: 200,
  },
  {
    name: 'symlog crossing zero',
    scaleType: 'symlog',
    raw: [-40, 60],
    height: 200,
  },
  {
    name: 'symlog entirely under 1',
    scaleType: 'symlog',
    raw: [0, 0.05],
    height: 200,
  },
  // short track: computeYTicks falls back to the domain endpoints
  { name: 'short track', scaleType: 'linear', raw: [0, 30], height: 60 },
  // A window whose scores are all one value autoscales to a domain of no
  // width — an all-zero coverage stretch is the everyday one. d3 answers the
  // midpoint for every input there while `makeScoreNormalizer` answers 0, so
  // the tick floated at half height over a plot drawn along the baseline.
  {
    name: 'flat domain at zero',
    scaleType: 'linear',
    raw: [0, 0],
    height: 200,
  },
  {
    name: 'flat domain, symlog',
    scaleType: 'symlog',
    raw: [0, 0],
    height: 200,
  },
] as const

describe.each(CASES)('$name', ({ scaleType, raw, height }) => {
  const domain = niced(scaleType, raw as unknown as [number, number])

  // 5 is the single-wiggle/manhattan label gutter; 0 is multi-wiggle, whose
  // rows stack edge to edge with no inset
  test.each([5, 0])('every tick lands on its data (offset %i)', offset => {
    const ticks = computeYTicks({
      height,
      domain,
      scaleType,
      minimalTicks: false,
      offset,
    })!
    const box = axisPlotBox(height, offset)
    const normalize = makeScoreNormalizer(
      domain[0],
      domain[1],
      scaleTypeFromString(scaleType),
      resolveSymlogConstant(domain[0], domain[1], 0),
    )
    expect(ticks.items.length).toBeGreaterThan(0)
    expect(ticks.yTop).toBe(box.yTop)
    expect(ticks.yBottom).toBe(box.yBottom)
    for (const { value, y } of ticks.items) {
      expect(y).toBeCloseTo(scoreToAxisY(normalize(value), box), 9)
    }
  })

  // A domain of no width has nothing to span, and the normalizer says so by
  // collapsing to `() => 0` — which is the answer the case above pins the axis
  // against.
  const testSpan = domain[0] === domain[1] ? test.skip : test
  testSpan('the domain spans the whole plot, not a point', () => {
    const normalize = makeScoreNormalizer(
      domain[0],
      domain[1],
      scaleTypeFromString(scaleType),
      resolveSymlogConstant(domain[0], domain[1], 0),
    )
    // the shape of the sub-1 log bug: normalize collapsed to `() => 0`, so
    // every score pinned to the baseline under a fully populated axis
    expect(normalize(domain[0])).toBe(0)
    expect(normalize(domain[1])).toBe(1)
  })
})

// Every wiggle-family caller pre-nices, so this was latent rather than broken —
// but the agreement should not depend on that. computeYTicks passes
// `nice: false`, placing ticks in exactly the domain it was handed; re-nicing
// put the axis up to half a pixel off the plot and, worse, invented an endpoint
// outside it (raw [1, 1000] became [1, 1024], a labelled tick at a value the
// data never reaches).
describe('a raw, un-niced domain', () => {
  const domain: [number, number] = [1, 1000]

  test('no tick claims a value outside the domain', () => {
    const ticks = computeYTicks({
      height: 200,
      domain,
      scaleType: 'log',
      minimalTicks: false,
    })!
    for (const { value } of ticks.items) {
      expect(value).toBeGreaterThanOrEqual(domain[0])
      expect(value).toBeLessThanOrEqual(domain[1])
    }
  })

  test.each(['linear', 'log'])('%s ticks still land on the data', scaleType => {
    const ticks = computeYTicks({
      height: 200,
      domain,
      scaleType,
      minimalTicks: false,
    })!
    const box = axisPlotBox(200, 5)
    const normalize = makeScoreNormalizer(
      domain[0],
      domain[1],
      scaleTypeFromString(scaleType),
      resolveSymlogConstant(domain[0], domain[1], 0),
    )
    for (const { value, y } of ticks.items) {
      expect(y).toBeCloseTo(scoreToAxisY(normalize(value), box), 9)
    }
  })
})

// The renderer draws `plotHeight` tall from `yTop`; the axis labels
// `yTop`..`yBottom`. The sweeps above already catch a `plotHeight` that
// disagrees, but only as a tick landing off its data — this names the invariant
// so the failure points at the box.
test.each([
  [200, 5],
  [200, 0],
  [40, 0],
])(
  'axisPlotBox(%i, %i) spans exactly what its ends label',
  (height, offset) => {
    const box = axisPlotBox(height, offset)
    expect(scoreToAxisY(0, box)).toBe(box.yBottom)
    expect(scoreToAxisY(1, box)).toBe(box.yTop)
  },
)

describe('clampStrokeInsideAxis', () => {
  test('a tick above the bottom edge keeps its own stroke position', () => {
    expect(clampStrokeInsideAxis(20.5, 95)).toBe(20.5)
  })

  test('the bottom edge draws on the last pixel inside the box', () => {
    // 95.5 would fill the pixel at y=95, the first one *below* a box ending at
    // 95 — in multi-wiggle that is the next sample's first row of pixels
    expect(clampStrokeInsideAxis(95.5, 95)).toBe(94.5)
  })

  test('a multi-wiggle row keeps its axis out of the row beneath it', () => {
    const rowHeight = 40
    const ticks = computeYTicks({
      height: rowHeight,
      domain: niced('linear', [0, 100]),
      scaleType: 'linear',
      minimalTicks: false,
      offset: 0,
    })!
    for (const { y } of ticks.items) {
      expect(clampStrokeInsideAxis(y + 0.5, ticks.yBottom)).toBeLessThan(
        rowHeight,
      )
    }
  })
})
