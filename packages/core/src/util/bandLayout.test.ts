import { clampBandHeight } from './bandHeight.ts'
import {
  bandAt,
  bandDragBounds,
  boundStackedBands,
  reservedPx,
  stackBands,
} from './bandLayout.ts'

test('a band that is off costs zero px, not its floor', () => {
  expect(reservedPx({ active: false, height: 40 })).toBe(0)
  expect(
    reservedPx({ active: false, height: 40, bounds: { min: 8, max: 120 } }),
  ).toBe(0)
})

test('deprecated per-band bounds still bind at read time', () => {
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

describe('a stack bound against the plot it shares', () => {
  const order = ['coverage', 'arcs', 'sashimi'] as const
  const plot = { height: 300, floor: 20 }
  const bands = (coverage: number, arcs: number, sashimi = 0) => ({
    coverage: { active: true, height: coverage },
    arcs: { active: true, height: arcs },
    sashimi: { active: sashimi > 0, height: sashimi },
  })

  test('two bands at their own ceilings leave the plot its floor', () => {
    const stack = stackBands(
      order,
      boundStackedBands(order, bands(5000, 5000), plot),
    )
    expect(stack.reserved).toEqual({ coverage: 280, arcs: 0, sashimi: 0 })
    expect(stack.bottom).toBe(280)
  })

  test('the band above binds first', () => {
    const bound = boundStackedBands(order, bands(100, 5000), plot)
    expect(bound.coverage.height).toBe(100)
    expect(bound.arcs.height).toBe(180)
  })

  test('a stack that fits is left as stated', () => {
    expect(boundStackedBands(order, bands(45, 30, 40), plot)).toEqual(
      bands(45, 30, 40),
    )
  })

  test('an inactive band is bound to the whole room, not the room left', () => {
    const bound = boundStackedBands(order, bands(200, 50), plot)
    expect(bound.sashimi).toEqual({ active: false, height: 0 })
    const off = boundStackedBands(
      order,
      { ...bands(200, 50), sashimi: { active: false, height: 5000 } },
      plot,
    )
    expect(off.sashimi.height).toBe(280)
  })

  test('a plot that draws nothing gives the bands all of it', () => {
    const stack = stackBands(
      order,
      boundStackedBands(order, bands(5000, 5000), { height: 300, floor: 0 }),
    )
    expect(stack.bottom).toBe(300)
  })

  test('a plot smaller than its floor leaves no room, never negative', () => {
    const bound = boundStackedBands(order, bands(45, 30), {
      height: 10,
      floor: 20,
    })
    expect(bound.coverage.height).toBe(0)
    expect(bound.arcs.height).toBe(0)
  })
})

describe('a drag in a bound stack', () => {
  const order = ['coverage', 'conservation'] as const
  const plot = { height: 300, floor: 20 }
  const stackOf = (coverage: number, conservation: number) =>
    stackBands(
      order,
      boundStackedBands(
        order,
        {
          coverage: { active: true, height: coverage },
          conservation: { active: true, height: conservation },
        },
        plot,
      ),
    )

  test('stops where every other band leaves the plot its floor', () => {
    const stack = stackOf(45, 40)
    expect(bandDragBounds(stack, 'coverage', plot)).toEqual({ max: 240 })
    expect(bandDragBounds(stack, 'conservation', plot)).toEqual({ max: 235 })
  })

  test('writes nothing the read-time bound cuts, whichever band moves', () => {
    for (const key of order) {
      const before = stackOf(45, 40)
      const dragged = clampBandHeight(
        before.reserved[key],
        5000,
        bandDragBounds(before, key, plot),
      )
      const after = stackOf(
        key === 'coverage' ? dragged : 45,
        key === 'conservation' ? dragged : 40,
      )
      expect(after.reserved[key]).toBe(dragged)
      expect(after.bottom).toBe(plot.height - plot.floor)
    }
  })

  test('two bands dragged to the limit in turn keep the plot its floor', () => {
    const coverage = clampBandHeight(
      45,
      5000,
      bandDragBounds(stackOf(45, 40), 'coverage', plot),
    )
    const conservation = clampBandHeight(
      40,
      5000,
      bandDragBounds(stackOf(coverage, 40), 'conservation', plot),
    )
    expect(stackOf(coverage, conservation).bottom).toBe(280)
  })
})
