import { getNiceDomain } from './scale.ts'

const noBounds = [undefined, undefined] as const

function isFiniteDomain([min, max]: [number, number]) {
  return Number.isFinite(min) && Number.isFinite(max)
}

test('linear domain includes the zero baseline', () => {
  expect(
    getNiceDomain({
      scaleType: 'linear',
      domain: [5, 100],
      bounds: noBounds,
    })[0],
  ).toBe(0)
  expect(
    getNiceDomain({
      scaleType: 'linear',
      domain: [-100, -5],
      bounds: noBounds,
    })[1],
  ).toBe(0)
})

test('linear explicit max bound caps the domain', () => {
  expect(
    getNiceDomain({
      scaleType: 'linear',
      domain: [5, 100],
      bounds: [undefined, 50],
    }),
  ).toEqual([0, 50])
})

test('log positive data floors at the origin', () => {
  const [min, max] = getNiceDomain({
    scaleType: 'log',
    domain: [50, 100],
    bounds: noBounds,
  })
  expect(min).toBe(1)
  expect(max).toBeGreaterThanOrEqual(100)
})

test('log data crossing zero yields a valid positive domain (no NaN)', () => {
  const domain = getNiceDomain({
    scaleType: 'log',
    domain: [-2, 100],
    bounds: noBounds,
  })
  expect(isFiniteDomain(domain)).toBe(true)
  expect(domain[0]).toBeGreaterThan(0)
  expect(domain[1]).toBeGreaterThan(domain[0])
})

test('log data entirely in (0,1) stays valid', () => {
  const domain = getNiceDomain({
    scaleType: 'log',
    domain: [0, 0.5],
    bounds: noBounds,
  })
  expect(isFiniteDomain(domain)).toBe(true)
  expect(domain[0]).toBeGreaterThan(0)
  expect(domain[1]).toBeGreaterThan(domain[0])
})

test('log all-negative data degrades to a valid domain', () => {
  const domain = getNiceDomain({
    scaleType: 'log',
    domain: [-5, -2],
    bounds: noBounds,
  })
  expect(isFiniteDomain(domain)).toBe(true)
  expect(domain[0]).toBeGreaterThan(0)
  expect(domain[1]).toBeGreaterThan(domain[0])
})

// The log guards run before the bounds are honoured and may move one scaleLog
// cannot hold; that correction has to outrank the bound, or the axis goes back
// to NaN ticks over a blank plot.
test('log explicit non-positive minScore bound is floored to stay valid', () => {
  const domain = getNiceDomain({
    scaleType: 'log',
    domain: [1, 100],
    bounds: [0, 100],
  })
  expect(isFiniteDomain(domain)).toBe(true)
  expect(domain[0]).toBeGreaterThan(0)
})

// The bound the "Set min/max score" dialog wrote, and the menu row goes on
// displaying, is the one the axis has to draw against. Nicing it turned a
// manual 3 – 97 into 0 – 100 — labelled, drawn and normalized against a range
// the user never asked for, under a menu still reading "(3 – 97)".
describe('an explicitly bounded end keeps its exact value', () => {
  test.each([
    ['linear', [3, 97]],
    ['linear', [1, 999]],
    ['symlog', [-7, 97]],
    ['log', [2, 900]],
  ] as [string, [number, number]][])(
    '%s bounds %j survive nicing',
    (scaleType, bounds) => {
      expect(getNiceDomain({ scaleType, domain: [5, 90], bounds })).toEqual(
        bounds,
      )
    },
  )

  test('an unbounded end is still niced', () => {
    expect(
      getNiceDomain({
        scaleType: 'linear',
        domain: [3, 97],
        bounds: [3, undefined],
      }),
    ).toEqual([3, 100])
  })
})
