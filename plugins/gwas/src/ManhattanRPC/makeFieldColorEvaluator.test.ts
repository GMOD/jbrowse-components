import { categoricalValueColor } from '@jbrowse/core/ui/colors'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import {
  NO_VALUE_LABEL,
  makeFieldColorEvaluator,
} from './makeFieldColorEvaluator.ts'

function feature(id: string, fields: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: id,
    refName: '1',
    start: 0,
    end: 1,
    ...fields,
  })
}

test('packs one color per distinct value and lists each value once', () => {
  const { color, scale } = makeFieldColorEvaluator('pop')
  const colors = ['CEU', 'YRI', 'CEU', 'CHB'].map((pop, i) =>
    color(feature(String(i), { pop })),
  )
  expect(colors[0]).toBe(colors[2])
  const distinct = [...new Set(colors)]
  expect(distinct).toHaveLength(3)
  expect(scale.entries.map(c => c.label)).toEqual(['CEU', 'YRI', 'CHB'])
  // the table is what the legend reads, so a swatch has to be the color
  // that was packed for its value
  expect(scale.entries.map(c => c.color)).toEqual(distinct)
})

test('two regions agree on a value without seeing each other', () => {
  const a = makeFieldColorEvaluator('pop')
  const b = makeFieldColorEvaluator('pop')
  a.color(feature('x', { pop: 'FIN' }))
  b.color(feature('y', { pop: 'GBR' }))
  b.color(feature('z', { pop: 'FIN' }))
  expect(b.scale.entries.find(c => c.label === 'FIN')?.color).toBe(
    a.scale.entries[0]!.color,
  )
  expect(a.scale.entries[0]!.color).toBe(
    cssColorToABGR(categoricalValueColor('FIN')),
  )
})

test('a feature with nothing in the field takes the grey no-value row', () => {
  const { color, scale } = makeFieldColorEvaluator('pop')
  const grey = color(feature('a', {}))
  expect(color(feature('b', { pop: '' }))).toBe(grey)
  expect(color(feature('c', { pop: 'CEU' }))).not.toBe(grey)
  expect(scale.entries.map(c => c.label)).toEqual([NO_VALUE_LABEL, 'CEU'])
})

test('a non-string value is keyed by its string form', () => {
  const { color, scale } = makeFieldColorEvaluator('n')
  color(feature('a', { n: 3 }))
  color(feature('b', { n: '3' }))
  expect(scale.entries).toHaveLength(1)
  expect(scale.entries[0]!.label).toBe('3')
})
