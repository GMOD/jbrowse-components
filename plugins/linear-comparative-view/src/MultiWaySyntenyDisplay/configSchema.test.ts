import { readConfObject } from '@jbrowse/core/configuration'
import { FEATURE_NAME_FIELD } from '@jbrowse/plugin-canvas'

import { configSchemaFactory } from './configSchema.ts'

const schema = configSchemaFactory()

function make(snapshot: Record<string, unknown> = {}) {
  return schema.create({
    type: 'MultiWaySyntenyDisplay',
    displayId: 'labels',
    ...snapshot,
  })
}

test('gene labels read the name, else the ID, and show by default', () => {
  const config = make()
  expect(readConfObject(config, ['labels', 'name', 'field'])).toBe(
    FEATURE_NAME_FIELD,
  )
  expect(readConfObject(config, ['labels', 'name', 'show'])).toBe(true)
})

test.each([
  [{ text: 'gene_name' }, ['gene_name', true]],
  [{ text: '' }, [FEATURE_NAME_FIELD, true]],
  [{ showGeneLabels: false }, [FEATURE_NAME_FIELD, false]],
  [{ text: 'product', showGeneLabels: false }, ['product', false]],
])('lifts the old %j onto labels.name', (old, [field, show]) => {
  const config = make(old)
  expect(readConfObject(config, ['labels', 'name', 'field'])).toBe(field)
  expect(readConfObject(config, ['labels', 'name', 'show'])).toBe(show)
})
