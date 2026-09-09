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
  const { evalColor, categories } = makeFieldColorEvaluator('pop')
  const colors = ['CEU', 'YRI', 'CEU', 'CHB'].map((pop, i) =>
    evalColor(feature(String(i), { pop })),
  )
  expect(colors[0]).toBe(colors[2])
  const distinct = [...new Set(colors)]
  expect(distinct).toHaveLength(3)
  expect(categories.map(c => c.value)).toEqual(['CEU', 'YRI', 'CHB'])
  // the table is what the legend reads, so a swatch has to be the color
  // that was packed for its value
  expect(categories.map(c => cssColorToABGR(c.color))).toEqual(distinct)
})

test('two regions agree on a value without seeing each other', () => {
  const a = makeFieldColorEvaluator('pop')
  const b = makeFieldColorEvaluator('pop')
  a.evalColor(feature('x', { pop: 'FIN' }))
  b.evalColor(feature('y', { pop: 'GBR' }))
  b.evalColor(feature('z', { pop: 'FIN' }))
  expect(b.categories.find(c => c.value === 'FIN')?.color).toBe(
    a.categories[0]!.color,
  )
  expect(a.categories[0]!.color).toBe(categoricalValueColor('FIN'))
})

test('a feature with nothing in the field takes the grey no-value row', () => {
  const { evalColor, categories } = makeFieldColorEvaluator('pop')
  const grey = evalColor(feature('a', {}))
  expect(evalColor(feature('b', { pop: '' }))).toBe(grey)
  expect(evalColor(feature('c', { pop: 'CEU' }))).not.toBe(grey)
  expect(categories.map(c => c.value)).toEqual([NO_VALUE_LABEL, 'CEU'])
})

test('a non-string value is keyed by its string form', () => {
  const { evalColor, categories } = makeFieldColorEvaluator('n')
  evalColor(feature('a', { n: 3 }))
  evalColor(feature('b', { n: '3' }))
  expect(categories).toHaveLength(1)
  expect(categories[0]!.value).toBe('3')
})
