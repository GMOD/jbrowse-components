import { plotOf, readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configSchemaFactory from './configSchema.ts'
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

test('refuses a scale, since each field has one', () => {
  expect(() => make({ color: { field: 'base', scale: 'linear' } })).toThrow(
    /scale/,
  )
})
