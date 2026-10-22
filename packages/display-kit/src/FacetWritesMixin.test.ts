import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { getSnapshot, onPatch, types } from '@jbrowse/mobx-state-tree'

import FacetWritesMixin, { facetForField } from './FacetWritesMixin.ts'
import { facetConfigSchema } from './facetConfigSchema.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()

const Display = types.compose(
  types.model({
    configuration: ConfigurationSchema('TestFacetWritesDisplay', {
      facet: facetConfigSchema,
    }),
  }),
  FacetWritesMixin(),
)

function display(facet?: Record<string, unknown>) {
  return Display.create(
    { configuration: facet === undefined ? {} : { facet } },
    { pluginManager },
  )
}

test('a new field starts with no order, and other members stay', () => {
  expect(
    facetForField(
      { field: 'type', sort: ['gene'], hidden: ['exon'], transform: [] },
      'strand',
    ),
  ).toEqual({ field: 'strand', transform: [] })
  expect(facetForField({ field: 'type', sort: ['gene'] }, '')).toEqual({})
})

test('re-picking the field grouping writes nothing, and a reorder keeps the field', () => {
  const d = display({ field: 'type', sort: ['gene'] })
  const patches: unknown[] = []
  onPatch(d, patch => patches.push(patch))
  d.facetByField('type')
  expect(patches).toEqual([])
  d.setFacetSort(['mRNA', 'gene'])
  expect(getSnapshot(d.configuration.facet)).toEqual({
    field: 'type',
    sort: ['mRNA', 'gene'],
  })
})

test('a reorder with nothing grouping writes nothing', () => {
  const d = display()
  d.setFacetSort(['a'])
  expect(d.writtenFacet).toEqual({})
})
