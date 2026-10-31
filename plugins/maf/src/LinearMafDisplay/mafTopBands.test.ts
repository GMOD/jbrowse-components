import { bandAt } from '@jbrowse/core/util/bandLayout'

import { mafTopBands } from './mafTopBands.ts'

const plot = { height: 300, floor: 20 }
const on = (height: number) => ({ active: true, height })

test('each rect is the fold’s top and reserved px', () => {
  const bands = mafTopBands({ coverage: on(45), conservation: on(40) }, plot)
  expect(bands.rects).toEqual({
    coverage: { top: 0, height: 45 },
    conservation: { top: 45, height: 40 },
  })
  expect(bands.bottom).toBe(85)
  expect(bandAt(bands, 50)).toBe('conservation')
})

test('the stack is bound to the plot less its floor, coverage first', () => {
  const bands = mafTopBands({ coverage: on(200), conservation: on(5000) }, plot)
  expect(bands.rects.conservation).toEqual({ top: 200, height: 80 })
  expect(bands.bottom).toBe(280)
})

test('an off band reserves nothing and moves the next one up', () => {
  const bands = mafTopBands(
    { coverage: { active: false, height: 45 }, conservation: on(40) },
    plot,
  )
  expect(bands.rects.coverage.height).toBe(0)
  expect(bands.rects.conservation.top).toBe(0)
})
