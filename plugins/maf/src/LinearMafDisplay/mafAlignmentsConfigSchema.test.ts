import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'

function make(snap: Record<string, unknown> = {}) {
  return configSchemaFactory().create({
    type: 'LinearMafDisplay',
    displayId: 'maf-test',
    ...snap,
  })
}

test('the overlays default off and the reference row on', () => {
  const conf = make()
  expect(readConfObject(conf, ['alignments', 'inversions', 'show'])).toBe(false)
  expect(readConfObject(conf, ['alignments', 'frames', 'show'])).toBe(false)
  expect(readConfObject(conf, ['alignments', 'reference', 'show'])).toBe(true)
})
