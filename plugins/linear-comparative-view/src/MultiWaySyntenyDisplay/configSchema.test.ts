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
