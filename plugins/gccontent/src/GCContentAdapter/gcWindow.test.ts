import { autoStep, resolveGCWindow } from './gcWindow.ts'

test.each([
  [0.3, 1],
  [1, 1],
  [1.99, 1],
  [2, 2],
  [4.99, 2],
  [5, 5],
  [9.99, 5],
  [10, 10],
  [49, 20],
  [250_000, 200_000],
  [1e9, 1e9],
])('at %d bp/px an auto step is %d bp', (bpPerPx, step) => {
  expect(autoStep(bpPerPx).step).toBe(step)
})

test('resolution 2 asks for twice the points, so half the step', () => {
  expect(autoStep(100, 2).step).toBe(50)
})

test('the zoom range holds the zoom it was resolved at, and no other rung', () => {
  for (let bpPerPx = 0.01; bpPerPx < 1e7; bpPerPx *= 1.37) {
    for (const resolution of [0.5, 1, 3]) {
      const { step, zoomRange } = autoStep(bpPerPx, resolution)
      expect(zoomRange.minBpPerPx).toBeLessThanOrEqual(bpPerPx)
      expect(bpPerPx).toBeLessThan(zoomRange.maxBpPerPx)
      expect(autoStep(zoomRange.minBpPerPx || 1e-9, resolution).step).toBe(step)
      expect(autoStep(zoomRange.maxBpPerPx, resolution).step).not.toBe(step)
    }
  }
})

test.each([
  ['no zoom', undefined, 1],
  ['a zero zoom', 0, 1],
  ['an infinite zoom', Infinity, 1],
  ['a zero resolution', 10, 0],
  ['a negative resolution', 10, -1],
])('an auto step with %s tiles the window', (_label, bpPerPx, resolution) => {
  expect(
    resolveGCWindow({ window: 100, step: 'auto', bpPerPx, resolution }),
  ).toEqual({ window: 100, step: 100, zoomRange: undefined })
})
