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
  'a written encoding.color: %p reads as its field and folds back to the string',
  field => {
    const conf = make({ encoding: { color: field } })
    expect(readConfObject(conf, ['encoding', 'color', 'field'])).toBe(field)
    expect(plotOf(conf)).toEqual(
      field === 'mismatch' ? {} : { encoding: { color: field } },
    )
  },
)

test('a default color reads back as no plot', () => {
  expect(plotOf(make())).toEqual({})
})

test.each([
  { field: 'identity', scale: { domainMin: 0.7 } },
  { field: 'identity', scale: { scheme: 'viridis', reverse: true } },
  { field: 'chromosome', scale: { range: ['red', 'blue'] } },
  {
    field: 'codon',
    scale: { names: ['Changed', 'Silent', 'Stop'] },
    legend: { title: 'Codons' },
  },
])('an object reads back unchanged: %j', color => {
  expect(plotOf(make({ encoding: { color } }))).toEqual({
    encoding: { color },
  })
})

test('a domain written as numbers reads as strings', () => {
  const conf = make({
    encoding: { color: { field: 'chromosome', scale: { domain: [0, 1] } } },
  })
  expect(getSnapshot(conf.encoding.color)).toMatchObject({
    scale: { domain: ['0', '1'] },
  })
})

test('a write refuses a scale type, since each field has one', () => {
  expect(() =>
    refusingUndeclaredKeys(() =>
      make({
        encoding: { color: { field: 'base', scale: { type: 'linear' } } },
      }),
    ),
  ).toThrow(/type/)
})

test('a flat member beside the field is refused, not read as unset', () => {
  expect(() =>
    refusingUndeclaredKeys(() =>
      make({ encoding: { color: { field: 'identity', domainMin: 0.7 } } }),
    ),
  ).toThrow(/domainMin/)
})

test('the legend is on until hidden, as legend.show', () => {
  expect(readConfObject(make(), ['legend', 'show'])).toBe(true)
  expect(plotOf(make({ legend: { show: false } }))).toEqual({
    legend: { show: false },
  })
})

test('the plot reaches the bar height, so Edit plot can draw the X-Y plot', () => {
  const conf = make({ encoding: { color: 'identity', y: 'identity' } })
  expect(plotOf(conf)).toEqual({
    encoding: { color: 'identity', y: 'identity' },
  })
  expect(plotOf(make({ y: 'identity' }))).toEqual({
    encoding: { y: 'identity' },
  })
})

test('a bare encoding.y keeps its field beside a lifted coverage scale', () => {
  const conf = make({
    encoding: { y: 'identity' },
    scales: { y: { type: 'log', domainMin: 1 } },
  })
  expect(readConfObject(conf, ['encoding', 'y', 'field'])).toBe('identity')
  expect(
    readConfObject(conf, ['coverage', 'encoding', 'y', 'scale', 'type']),
  ).toBe('log')
  expect(
    readConfObject(conf, ['coverage', 'encoding', 'y', 'scale', 'domainMin']),
  ).toBe(1)
})

test.each(MAF_PLOT_EXAMPLES)('the example $plot lifts', ({ plot }) => {
  const conf = make()
  expect(() => liftPlot(conf, parsePlot(plot, plotKeysOf(conf)))).not.toThrow()
})
