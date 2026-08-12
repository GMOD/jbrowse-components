import { dropZoneAt, indicatorRect, splitForZone } from './dropZone.ts'

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

test('the indicator covers the half the view would land in', () => {
  expect(indicatorRect('right')).toEqual({
    left: '50%',
    top: '0%',
    width: '50%',
    height: '100%',
  })
  expect(indicatorRect('center').width).toBe('100%')
})
