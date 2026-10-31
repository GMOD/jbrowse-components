import { bandAt, reservedPx, stackBands } from './bandLayout.ts'

test('a band that is off costs zero px, not its floor', () => {
  expect(reservedPx({ active: false, height: 40 })).toBe(0)
  expect(
    reservedPx({ active: false, height: 40, bounds: { min: 8, max: 120 } }),
  ).toBe(0)
})

test('bounds bind the stated height at read time when present', () => {
  expect(
    reservedPx({ active: true, height: 4000, bounds: { min: 8, max: 120 } }),
  ).toBe(120)
  expect(
    reservedPx({ active: true, height: 1, bounds: { min: 8, max: 120 } }),
  ).toBe(8)
})

test('without bounds the stated height is trusted as-is', () => {
  expect(reservedPx({ active: true, height: 3 })).toBe(3)
})

test('the fold states the order once and every top reads it', () => {
  const stack = stackBands(['coverage', 'arcs', 'sashimi'], {
    coverage: { active: true, height: 45 },
    arcs: { active: true, height: 30 },
    sashimi: { active: false, height: 30 },
  })
  expect(stack).toEqual({
    order: ['coverage', 'arcs', 'sashimi'],
    top: { coverage: 0, arcs: 45, sashimi: 75 },
    reserved: { coverage: 45, arcs: 30, sashimi: 0 },
    bottom: 75,
  })
})

test('an inactive band passes its top through to the next band', () => {
  const stack = stackBands(['a', 'b'], {
    a: { active: false, height: 100 },
    b: { active: true, height: 20 },
  })
  expect(stack.top.b).toBe(0)
  expect(stack.bottom).toBe(20)
})

test('the pointer finds the band the fold placed, and none below it', () => {
  const stack = stackBands(['coverage', 'off', 'conservation'], {
    coverage: { active: true, height: 40 },
    off: { active: false, height: 30 },
    conservation: { active: true, height: 20 },
  })
  expect(bandAt(stack, 0)).toBe('coverage')
  expect(bandAt(stack, 39.5)).toBe('coverage')
  expect(bandAt(stack, 40)).toBe('conservation')
  expect(bandAt(stack, 59)).toBe('conservation')
  expect(bandAt(stack, 60)).toBeUndefined()
  expect(bandAt(stack, -1)).toBeUndefined()
})
