import { readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import configSchemaFactory from './configSchema.ts'

function make(snap: Record<string, unknown> = {}) {
  return configSchemaFactory().create({
    type: 'LinearMafDisplay',
    displayId: 'maf-test',
    ...snap,
  })
}

test("the v4 mafviewer plugin's top-level row settings lift into alignments", () => {
  const conf = make({
    rowProportion: 0.5,
    showAllLetters: true,
    showAsUpperCase: false,
  })
  expect(readConfObject(conf, ['alignments', 'rowProportion'])).toBe(0.5)
  expect(getSnapshot(conf)).not.toHaveProperty('showAllLetters')
  expect(getSnapshot(conf)).not.toHaveProperty('showAsUpperCase')
})

test('a lifted setting merges with the alignments members a config writes', () => {
  const conf = make({
    rowProportion: 0.5,
    alignments: { inversions: { show: true } },
  })
  expect(readConfObject(conf, ['alignments', 'rowProportion'])).toBe(0.5)
  expect(readConfObject(conf, ['alignments', 'inversions', 'show'])).toBe(true)
})

test('the overlays default off and the reference row on', () => {
  const conf = make()
  expect(readConfObject(conf, ['alignments', 'inversions', 'show'])).toBe(false)
  expect(readConfObject(conf, ['alignments', 'frames', 'show'])).toBe(false)
  expect(readConfObject(conf, ['alignments', 'reference', 'show'])).toBe(true)
})
