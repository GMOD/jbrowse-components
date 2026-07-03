import { getNiceDomain } from './scale.ts'

const noBounds = [undefined, undefined] as const

function isFiniteDomain([min, max]: [number, number]) {
  return Number.isFinite(min) && Number.isFinite(max)
}

test('linear domain includes the zero baseline', () => {
  expect(getNiceDomain({ scaleType: 'linear', domain: [5, 100], bounds: noBounds })[0]).toBe(0)
  expect(getNiceDomain({ scaleType: 'linear', domain: [-100, -5], bounds: noBounds })[1]).toBe(0)
})

test('linear explicit max bound caps the domain', () => {
  expect(
    getNiceDomain({ scaleType: 'linear', domain: [5, 100], bounds: [undefined, 50] }),
  ).toEqual([0, 50])
})

test('log positive data floors at the origin', () => {
  const [min, max] = getNiceDomain({ scaleType: 'log', domain: [50, 100], bounds: noBounds })
  expect(min).toBe(1)
  expect(max).toBeGreaterThanOrEqual(100)
})

test('log data crossing zero yields a valid positive domain (no NaN)', () => {
  const domain = getNiceDomain({ scaleType: 'log', domain: [-2, 100], bounds: noBounds })
  expect(isFiniteDomain(domain)).toBe(true)
  expect(domain[0]).toBeGreaterThan(0)
  expect(domain[1]).toBeGreaterThan(domain[0])
})

test('log data entirely in (0,1) stays valid', () => {
  const domain = getNiceDomain({ scaleType: 'log', domain: [0, 0.5], bounds: noBounds })
  expect(isFiniteDomain(domain)).toBe(true)
  expect(domain[0]).toBeGreaterThan(0)
  expect(domain[1]).toBeGreaterThan(domain[0])
})

test('log all-negative data degrades to a valid domain', () => {
  const domain = getNiceDomain({ scaleType: 'log', domain: [-5, -2], bounds: noBounds })
  expect(isFiniteDomain(domain)).toBe(true)
  expect(domain[0]).toBeGreaterThan(0)
  expect(domain[1]).toBeGreaterThan(domain[0])
})

test('log explicit non-positive minScore bound is floored to stay valid', () => {
  const domain = getNiceDomain({ scaleType: 'log', domain: [1, 100], bounds: [0, 100] })
  expect(isFiniteDomain(domain)).toBe(true)
  expect(domain[0]).toBeGreaterThan(0)
})
