import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
} from '@jbrowse/wiggle-core'

import {
  getRowHeight,
  getRowTop,
  isLineMode,
  isScatterMode,
  renderingTypeToInt,
} from './wiggleComponentUtils.ts'

describe('isScatterMode', () => {
  test('scatter returns true', () => {
    expect(isScatterMode('scatter')).toBe(true)
  })

  test('non-scatter types return false', () => {
    expect(isScatterMode('xyplot')).toBe(false)
    expect(isScatterMode('line')).toBe(false)
    expect(isScatterMode('density')).toBe(false)
  })
})

describe('isLineMode', () => {
  test('both line renderings return true', () => {
    expect(isLineMode('line')).toBe(true)
    expect(isLineMode('linecenter')).toBe(true)
  })

  test('non-line types return false', () => {
    expect(isLineMode('xyplot')).toBe(false)
    expect(isLineMode('density')).toBe(false)
    expect(isLineMode('scatter')).toBe(false)
  })
})

describe('renderingTypeToInt', () => {
  test('every rendering maps to its shader mode', () => {
    expect(renderingTypeToInt('xyplot')).toBe(RENDERING_TYPE_XYPLOT)
    expect(renderingTypeToInt('density')).toBe(RENDERING_TYPE_DENSITY)
    expect(renderingTypeToInt('line')).toBe(RENDERING_TYPE_LINE)
    expect(renderingTypeToInt('linecenter')).toBe(RENDERING_TYPE_LINE_CENTER)
    expect(renderingTypeToInt('scatter')).toBe(RENDERING_TYPE_SCATTER)
  })

  test('unknown types throw', () => {
    expect(() => renderingTypeToInt('unknown')).toThrow(
      /Unknown wiggle rendering type/,
    )
  })
})

describe('getRowHeight', () => {
  test('divides canvas height by number of rows', () => {
    expect(getRowHeight(200, 4)).toBe(50)
  })

  test('returns full height for 0 rows', () => {
    expect(getRowHeight(200, 0)).toBe(200)
  })

  test('returns full height for 1 row', () => {
    expect(getRowHeight(200, 1)).toBe(200)
  })
})

describe('getRowTop', () => {
  test('computes row offset', () => {
    expect(getRowTop(0, 50)).toBe(0)
    expect(getRowTop(1, 50)).toBe(50)
    expect(getRowTop(3, 50)).toBe(150)
  })
})
