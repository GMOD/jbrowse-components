import { computeYTicks } from './computeYTicks.ts'

test('a log axis over allele frequencies ticks at powers of ten, labelled compactly', () => {
  const t = computeYTicks({
    height: 200,
    domain: [2 ** -20, 1],
    scaleType: 'log',
  })
  expect(t?.items.map(i => i.value)).toEqual([1e-6, 1e-4, 0.01, 1])
  expect(t?.items.map(i => i.label)).toEqual(['1e-6', '1e-4', '0.01', '1'])
})

test('a log axis over a single decade still ticks', () => {
  const t = computeYTicks({ height: 200, domain: [1, 8], scaleType: 'log' })
  expect(t?.items.length).toBeGreaterThan(1)
})
