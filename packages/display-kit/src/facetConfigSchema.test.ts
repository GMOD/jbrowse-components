import {
  ConfigurationSchema,
  applyConfSettings,
} from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { facetConfigSchema } from './facetConfigSchema.ts'

const Display = ConfigurationSchema('FacetHost', { facet: facetConfigSchema })

test('null clears the facet rather than failing the load', () => {
  expect(getSnapshot(Display.create({ facet: null }))).toEqual({})
})

test('a comment key rides along unrefused', () => {
  expect(
    getSnapshot(Display.create({ facet: { field: 'strand', _comment: 'x' } })),
  ).toEqual({ facet: { field: 'strand' } })
})

test('a lone sort value is a list of one, and the field beside it lands', () => {
  const conf = Display.create()
  const report = applyConfSettings(conf, {
    facet: { field: 'strand', sort: '-' },
  })
  expect(report.failed).toEqual([])
  expect(getSnapshot(conf)).toEqual({
    facet: { field: 'strand', sort: ['-'] },
  })
})
