import {
  parsePhysicalWidth,
  physicalRootSize,
  resolveFigureSize,
  sizeSvgForRaster,
  svgRootIsPhysical,
} from './figureSize.ts'

test('a width with a unit is physical, a bare number is not', () => {
  expect(parsePhysicalWidth('183mm')).toEqual({ value: 183, unit: 'mm' })
  expect(parsePhysicalWidth(' 7.2 IN ')).toEqual({ value: 7.2, unit: 'in' })
  expect(parsePhysicalWidth('18.3cm')).toEqual({ value: 18.3, unit: 'cm' })
  expect(parsePhysicalWidth('1600')).toBeUndefined()
  expect(parsePhysicalWidth('1600px')).toBeUndefined()
  expect(parsePhysicalWidth('0mm')).toBeUndefined()
})

test('13 px labels at their natural 9.75 pt lay the page out at 96 px an inch', () => {
  const size = resolveFigureSize({
    pageWidth: { value: 183, unit: 'mm' },
    textPt: 9.75,
    labelPx: 13,
    chromePx: 100,
  })
  expect(size.scale).toBe(1)
  expect(size.documentPx).toBeCloseTo(691.65, 1)
  expect(size.plotPx).toBe(591)
  expect(size.rasterScale).toBeCloseTo(3.125)
})

test('smaller text lays the same page out across more px', () => {
  const size = resolveFigureSize({
    pageWidth: { value: 183, unit: 'mm' },
    textPt: 7,
    labelPx: 13,
    chromePx: 100,
  })
  expect(size.documentPx).toBeCloseTo(963.4, 1)
  expect(size.plotPx).toBe(863)
  expect(size.rasterScale * size.documentPx).toBeCloseTo((183 / 25.4) * 300)
})

test('larger text lays a slide out across fewer px', () => {
  const size = resolveFigureSize({
    pageWidth: { value: 13.33, unit: 'in' },
    textPt: 18,
    labelPx: 13,
    chromePx: 100,
  })
  expect(size.scale).toBeCloseTo(1.846, 3)
  expect(size.plotPx).toBe(593)
})

test('the root height follows the document aspect in the width unit', () => {
  expect(physicalRootSize({ value: 183, unit: 'mm' }, 692, 256)).toEqual({
    width: '183mm',
    height: '67.7mm',
  })
})

test('a physical root rasterizes at 300 dpi, a px root at twice its px', () => {
  expect(
    sizeSvgForRaster(
      '<svg width="183mm" height="67.7mm" viewBox="0 0 692 256"><rect width="5"/></svg>',
    ),
  ).toBe(
    '<svg width="2161" height="800" viewBox="0 0 692 256"><rect width="5"/></svg>',
  )
  expect(
    sizeSvgForRaster(
      '<svg width="1800" height="400.5" viewBox="0 0 1800 400.5"><rect width="5"/></svg>',
    ),
  ).toBe(
    '<svg width="3600" height="801" viewBox="0 0 1800 400.5"><rect width="5"/></svg>',
  )
})

test('a root is physical when its width has a unit', () => {
  expect(svgRootIsPhysical('<svg width="183mm" height="60mm"></svg>')).toBe(
    true,
  )
  expect(svgRootIsPhysical('<svg width="1800" height="400"></svg>')).toBe(false)
})
