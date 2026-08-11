import {
  recombinationBox,
  recombinationTicks,
  recombinationY,
} from './recombinationAxis.ts'

// The rule `YScaleTicks` states, over the pair that has to keep it: the number
// beside the curve and the height the curve reaches are the same claim, so a
// tick at value v must sit where a point of value v is plotted. Nothing here
// re-implements either — both sides are the shipped functions.
describe('the recombination axis and the curve share one scale', () => {
  test.each([
    [40, 0.1],
    [60, 0.5],
    [120, 1],
  ])('height %i, max %f', (height, maxValue) => {
    const box = recombinationBox(height)
    const { items, yTop, yBottom } = recombinationTicks(height, maxValue)
    expect(yTop).toBe(box.yTop)
    expect(yBottom).toBe(box.yBottom)
    for (const { value, y } of items) {
      expect(y).toBeCloseTo(recombinationY(value, maxValue, box), 9)
    }
  })

  test('the ends of the axis are the ends of the plot box', () => {
    const { items, yTop, yBottom } = recombinationTicks(60, 0.5)
    // items run max-first (0.00 is the last), matching the ascending y order
    expect(items[0]!.value).toBe(0)
    expect(items[0]!.y).toBe(yBottom)
    expect(items.at(-1)!.value).toBe(0.5)
    expect(items.at(-1)!.y).toBe(yTop)
  })

  // YScaleBar and CrossHatchLines key on `${value}-${y}`; a repeat is a React
  // duplicate key and a label drawn over itself. `recombinationMax` floors at
  // 0.1, so a degenerate all-zero curve can't reach here — but the axis should
  // not depend on that to be well formed.
  test('no two ticks collide', () => {
    for (const maxValue of [0.1, 0.25, 1]) {
      const items = recombinationTicks(60, maxValue).items
      expect(new Set(items.map(t => `${t.value}-${t.y}`)).size).toBe(
        items.length,
      )
    }
  })

  test('labels carry two decimals, so adjacent ticks read apart', () => {
    expect(recombinationTicks(60, 1).items.map(t => t.label)).toEqual([
      '0.00',
      '0.25',
      '0.50',
      '0.75',
      '1.00',
    ])
  })
})
