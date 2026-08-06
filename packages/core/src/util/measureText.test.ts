import { measureText } from './measureText.ts'

test('proportional metrics vary per character', () => {
  // Helvetica: `i` is narrow, `m` is wide. This is the whole reason the table
  // exists, and the whole reason it cannot stand in for a monospace face.
  expect(measureText('iiii', 13)).toBeLessThan(measureText('mmmm', 13))
})

test('monospace gives every character the same advance', () => {
  expect(measureText('iiii', 13, 'monospace')).toBe(
    measureText('mmmm', 13, 'monospace'),
  )
})

// The SVG export offers a font picker, and its layout math measures with these
// numbers: `trackLabelLeftOffset` reserves the left-label gutter from the widest
// track name. Measured against the Helvetica table, a monospace name full of
// narrow letters comes out far too small and the label overflows the gutter into
// the track body.
test('a narrow-lettered name is not under-measured in monospace', () => {
  const name = 'illiillii'
  expect(measureText(name, 13, 'monospace')).toBeGreaterThan(
    measureText(name, 13),
  )
})

test('a named monospace stack is still recognized as monospace', () => {
  expect(measureText('abc', 13, 'Courier New, monospace')).toBe(
    measureText('abc', 13, 'monospace'),
  )
})

test('the default-font sentinel and the proportional families keep the table', () => {
  const table = measureText('illi', 13)
  expect(measureText('illi', 13, '')).toBe(table)
  expect(measureText('illi', 13, undefined)).toBe(table)
  expect(measureText('illi', 13, 'serif')).toBe(table)
})

test('width scales linearly with font size', () => {
  expect(measureText('abc', 26)).toBeCloseTo(measureText('abc', 13) * 2)
  expect(measureText('abc', 26, 'monospace')).toBeCloseTo(
    measureText('abc', 13, 'monospace') * 2,
  )
})
