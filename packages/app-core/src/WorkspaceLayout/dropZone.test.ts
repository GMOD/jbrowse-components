import {
  dropZoneAt,
  indicatorRect,
  splitForZone,
  stripDropAt,
} from './dropZone.ts'

const rect = { left: 0, top: 0, width: 400, height: 200 }

describe('dropZoneAt', () => {
  test('the middle is a tab drop', () => {
    expect(dropZoneAt(rect, 200, 100)).toBe('center')
  })

  test('each edge band gives its own split', () => {
    expect(dropZoneAt(rect, 10, 100)).toBe('left')
    expect(dropZoneAt(rect, 390, 100)).toBe('right')
    expect(dropZoneAt(rect, 200, 5)).toBe('top')
    expect(dropZoneAt(rect, 200, 195)).toBe('bottom')
  })

  test('bands are proportional, so a narrow panel keeps a centre', () => {
    const narrow = { left: 0, top: 0, width: 80, height: 80 }
    expect(dropZoneAt(narrow, 40, 40)).toBe('center')
    expect(dropZoneAt(narrow, 4, 40)).toBe('left')
  })

  test('a corner goes to whichever edge the pointer is deeper into', () => {
    // 2px into a 100px left band, 1px into a 50px top band: proportionally the
    // top is deeper (98% vs 98%... so make it unambiguous)
    expect(dropZoneAt(rect, 1, 40)).toBe('left')
    expect(dropZoneAt(rect, 60, 1)).toBe('top')
  })

  test('the exact corner is decided, not undefined', () => {
    // equal proportional depth on both axes — still returns one of them
    expect(['left', 'top']).toContain(dropZoneAt(rect, 0, 0))
  })

  test('an edgeFraction of 0.5 or more still leaves a centre', () => {
    expect(dropZoneAt(rect, 200, 100, 0.5)).toBe('center')
    expect(dropZoneAt(rect, 200, 100, 5)).toBe('center')
  })

  test('a zero-sized panel is a tab drop rather than a divide by zero', () => {
    expect(dropZoneAt({ left: 0, top: 0, width: 0, height: 0 }, 0, 0)).toBe(
      'center',
    )
  })
})

describe('splitForZone', () => {
  test('edges map to a direction and a side', () => {
    expect(splitForZone('left')).toEqual({ direction: 'row', before: true })
    expect(splitForZone('right')).toEqual({ direction: 'row', before: false })
    expect(splitForZone('top')).toEqual({ direction: 'column', before: true })
    expect(splitForZone('bottom')).toEqual({
      direction: 'column',
      before: false,
    })
  })

  test('center is not a split', () => {
    expect(splitForZone('center')).toBeUndefined()
  })
})

describe('stripDropAt', () => {
  // three 100px tabs in a row, so the midpoints are at 50, 150 and 250
  const tabs = [
    { left: 0, top: 0, width: 100, height: 35 },
    { left: 100, top: 0, width: 100, height: 35 },
    { left: 200, top: 0, width: 100, height: 35 },
  ]

  test('the left half of a tab inserts before it, the right half after', () => {
    expect(stripDropAt(tabs, 10).index).toBe(0)
    expect(stripDropAt(tabs, 49).index).toBe(0)
    expect(stripDropAt(tabs, 51).index).toBe(1)
    expect(stripDropAt(tabs, 149).index).toBe(1)
    expect(stripDropAt(tabs, 151).index).toBe(2)
  })

  test('past the last tab is the end', () => {
    expect(stripDropAt(tabs, 260).index).toBe(3)
    expect(stripDropAt(tabs, 5000).index).toBe(3)
  })

  // The midpoint test is what makes this total: every x belongs to exactly one
  // gap, so there is no band between two tabs where a drop has to fall back to
  // appending — which is what "drop anywhere on the strip" would degrade to.
  test('every position on the strip resolves to a gap', () => {
    for (let x = -50; x < 350; x += 7) {
      const { index } = stripDropAt(tabs, x)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThanOrEqual(tabs.length)
    }
  })

  test('the caret is drawn at the gap, not at the pointer', () => {
    expect(stripDropAt(tabs, 10).left).toBe(0)
    expect(stripDropAt(tabs, 120).left).toBe(100)
    // after the last tab, the caret sits at its trailing edge
    expect(stripDropAt(tabs, 400).left).toBe(300)
  })

  test('an empty strip takes the tab at index 0', () => {
    expect(stripDropAt([], 40)).toEqual({ index: 0, left: 0 })
  })
})

test('the indicator covers the half the view would land in', () => {
  expect(indicatorRect('right')).toEqual({
    left: '50%',
    top: '0%',
    width: '50%',
    height: '100%',
  })
  expect(indicatorRect('center').width).toBe('100%')
})
