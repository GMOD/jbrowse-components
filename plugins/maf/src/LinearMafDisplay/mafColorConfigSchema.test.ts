import {
  liftPlot,
  parsePlot,
  plotKeysOf,
  plotOf,
  readConfObject,
  refusingUndeclaredKeys,
} from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configSchemaFactory from './configSchema.ts'
import { MAF_PLOT_EXAMPLES } from './plotExamples.ts'
import { MAF_COLOR_FIELDS } from './rowRenderings.ts'

function make(snap: Record<string, unknown> = {}) {
  return configSchemaFactory().create({
    type: 'LinearMafDisplay',
    displayId: 'maf-test',
    ...snap,
  })
}

test.each(MAF_COLOR_FIELDS)(
  'a written color: %p reads as its field and folds back to the string',
  field => {
    const conf = make({ color: field })
    expect(readConfObject(conf, ['color', 'field'])).toBe(field)
    expect(plotOf(conf)).toEqual(field === 'mismatch' ? {} : { color: field })
  },
)

test('a default colour reads back as no plot', () => {
  expect(plotOf(make())).toEqual({})
})

test.each([
  { field: 'identity', domainMin: 0.7 },
  { field: 'identity', scheme: 'viridis', reverse: true },
  { field: 'chromosome', range: ['red', 'blue'] },
  { field: 'codon', labels: ['Changed', 'Silent', 'Stop'], title: 'Codons' },
])('an object reads back unchanged: %j', color => {
  expect(plotOf(make({ color }))).toEqual({ color })
})

test('a domain written as numbers reads as strings', () => {
  const conf = make({ color: { field: 'chromosome', domain: [0, 1] } })
  expect(getSnapshot(conf.color)).toMatchObject({ domain: ['0', '1'] })
})

test('a write refuses a scale, since each field has one', () => {
  expect(() =>
    refusingUndeclaredKeys(() =>
      make({ color: { field: 'base', scale: 'linear' } }),
    ),
  ).toThrow(/scale/)
})

test('the plot reaches the bar height, so Edit plot can draw the X-Y plot', () => {
  const conf = make({ color: 'identity', y: 'identity' })
  expect(plotKeysOf(conf)).toContain('y')
  expect(plotOf(conf)).toEqual({ color: 'identity', y: 'identity' })
})

test.each(MAF_PLOT_EXAMPLES)('the example $plot lifts', ({ plot }) => {
  const conf = make()
  expect(() => liftPlot(conf, parsePlot(plot, plotKeysOf(conf)))).not.toThrow()
})
