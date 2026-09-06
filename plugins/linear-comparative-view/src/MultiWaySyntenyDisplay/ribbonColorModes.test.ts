import { SimpleFeature } from '@jbrowse/core/util'

import {
  coerceRibbonColorBy,
  featureLabelTable,
  ribbonColorModeOptions,
} from './ribbonColorModes.ts'

function feature(data: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: String(Math.random()),
    refName: 'chr1',
    start: 0,
    end: 1,
    ...data,
  })
}

test('the slot keeps the fixed modes and any named column, and rejects the rest', () => {
  expect(coerceRibbonColorBy('strand')).toBe('strand')
  expect(coerceRibbonColorBy('attribute:group')).toBe('attribute:group')
  expect(coerceRibbonColorBy('attribute:')).toBe('default')
  expect(coerceRibbonColorBy('rainbow')).toBe('default')
})

test('the menu offers the fixed modes then one entry per declared column', () => {
  expect(ribbonColorModeOptions(['group', 'dn']).map(([v]) => v)).toEqual([
    'default',
    'strand',
    'identity',
    'attribute:group',
    'attribute:dn',
  ])
})

// The same table the worker builds for the synteny views, read off the
// features this display already holds: labels in first-seen order, the file's
// color the first time a label had one, and a numeric column reports nothing.
test('featureLabelTable reads text columns in first-seen order with their file colors', () => {
  const table = featureLabelTable(
    [
      feature({ group: 'B1', dn: 0.2 }),
      feature({ group: 'A1a', color: '#4DB5E3', dn: 0.4 }),
      feature({ group: 'B1', color: '#2F54E3' }),
      feature({}),
    ],
    ['group', 'dn'],
  )
  expect(table).toEqual({
    group: { labels: ['B1', 'A1a'], colors: { A1a: '#4DB5E3', B1: '#2F54E3' } },
  })
})
