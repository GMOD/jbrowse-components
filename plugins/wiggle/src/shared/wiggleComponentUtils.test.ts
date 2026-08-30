import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_SCATTER,
  RENDERING_TYPE_XYPLOT,
} from '@jbrowse/wiggle-core'

import {
  MULTI_WIGGLE_RENDERING_GROUPS,
  MULTI_WIGGLE_RENDERING_TYPES,
} from '../renderingTypes.ts'
import {
  getRowHeight,
  getRowTop,
  isLineMode,
  isOverlayMode,
  isScatterMode,
  renderingTypeToInt,
} from './wiggleComponentUtils.ts'

describe('isOverlayMode', () => {
  test('overlay types return true', () => {
    expect(isOverlayMode('multixyplot')).toBe(true)
    expect(isOverlayMode('multiline')).toBe(true)
    expect(isOverlayMode('multiscatter')).toBe(true)
  })

  test('multirow types return false', () => {
    expect(isOverlayMode('multirowxy')).toBe(false)
    expect(isOverlayMode('multirowdensity')).toBe(false)
    expect(isOverlayMode('multirowline')).toBe(false)
    expect(isOverlayMode('multirowscatter')).toBe(false)
  })

  test('density is not an overlay type', () => {
    expect(isOverlayMode('density')).toBe(false)
  })

  // The set is derived from the menu table, so this is what catches an
  // overlapping plot type added there and silently laid out as multi-row.
  test('covers exactly the Overlapping menu group', () => {
    const [, overlapping] = MULTI_WIGGLE_RENDERING_GROUPS[1]
    expect(overlapping.map(([value]) => value).every(isOverlayMode)).toBe(true)
    expect(MULTI_WIGGLE_RENDERING_TYPES.filter(isOverlayMode)).toHaveLength(
      overlapping.length,
    )
  })
})

describe('isScatterMode', () => {
  test('scatter types return true', () => {
    expect(isScatterMode('multirowscatter')).toBe(true)
    expect(isScatterMode('multiscatter')).toBe(true)
  })

  test('non-scatter types return false', () => {
    expect(isScatterMode('multixyplot')).toBe(false)
    expect(isScatterMode('multiline')).toBe(false)
    expect(isScatterMode('multirowxy')).toBe(false)
  })
})

describe('isLineMode', () => {
  test('both line renderings return true', () => {
    expect(isLineMode('line')).toBe(true)
    expect(isLineMode('linecenter')).toBe(true)
    expect(isLineMode('multirowline')).toBe(true)
    expect(isLineMode('multilinecenter')).toBe(true)
  })

  test('non-line types return false', () => {
    expect(isLineMode('multirowxy')).toBe(false)
    expect(isLineMode('multirowdensity')).toBe(false)
    expect(isLineMode('multiscatter')).toBe(false)
  })
})

describe('renderingTypeToInt', () => {
  test('single-wiggle variants map correctly', () => {
    expect(renderingTypeToInt('xyplot')).toBe(RENDERING_TYPE_XYPLOT)
    expect(renderingTypeToInt('density')).toBe(RENDERING_TYPE_DENSITY)
    expect(renderingTypeToInt('line')).toBe(RENDERING_TYPE_LINE)
    expect(renderingTypeToInt('scatter')).toBe(RENDERING_TYPE_SCATTER)
  })

  test('multi-wiggle variants map to same int', () => {
    expect(renderingTypeToInt('multirowxy')).toBe(RENDERING_TYPE_XYPLOT)
    expect(renderingTypeToInt('multixyplot')).toBe(RENDERING_TYPE_XYPLOT)
    expect(renderingTypeToInt('multirowline')).toBe(RENDERING_TYPE_LINE)
    expect(renderingTypeToInt('multiline')).toBe(RENDERING_TYPE_LINE)
    expect(renderingTypeToInt('multirowscatter')).toBe(RENDERING_TYPE_SCATTER)
    expect(renderingTypeToInt('multiscatter')).toBe(RENDERING_TYPE_SCATTER)
    expect(renderingTypeToInt('multirowdensity')).toBe(RENDERING_TYPE_DENSITY)
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
