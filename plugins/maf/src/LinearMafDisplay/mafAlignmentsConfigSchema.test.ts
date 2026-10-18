import { readConfObject } from '@jbrowse/core/configuration'

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
  expect(readConfObject(conf, ['alignments', 'showAllLetters'])).toBe(true)
  expect(readConfObject(conf, ['alignments', 'showAsUpperCase'])).toBe(false)
})

test('a lifted setting merges with the alignments members a config writes', () => {
  const conf = make({
    showAllLetters: true,
    alignments: { showInversions: true },
  })
  expect(readConfObject(conf, ['alignments', 'showAllLetters'])).toBe(true)
  expect(readConfObject(conf, ['alignments', 'showInversions'])).toBe(true)
})
