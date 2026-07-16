import { getFillProps, getStrokeProps, stripAlpha } from './svgColorProps.ts'

test('splits an opaque color into hex + opacity 1', () => {
  expect(getStrokeProps('#ff0000')).toEqual({
    stroke: '#ff0000',
    strokeOpacity: 1,
  })
})

test('splits alpha out of an rgba color', () => {
  expect(getFillProps('rgba(255, 0, 0, 0.5)')).toEqual({
    fill: '#ff0000',
    fillOpacity: 128 / 255,
  })
})

test('handles named colors, 8-digit hex, and transparent', () => {
  expect(getStrokeProps('red')).toEqual({ stroke: '#ff0000', strokeOpacity: 1 })
  expect(getStrokeProps('#ff000080')).toEqual({
    stroke: '#ff0000',
    strokeOpacity: 128 / 255,
  })
  expect(getStrokeProps('transparent')).toEqual({
    stroke: '#000000',
    strokeOpacity: 0,
  })
})

test('falls back to black on malformed input', () => {
  expect(getStrokeProps('rgb()')).toEqual({
    stroke: '#000000',
    strokeOpacity: 1,
  })
})

test('returns no props for an empty string', () => {
  expect(getStrokeProps('')).toEqual({})
})

test('stripAlpha drops the alpha channel', () => {
  expect(stripAlpha('rgba(255, 0, 0, 0.5)')).toBe('#ff0000')
})
