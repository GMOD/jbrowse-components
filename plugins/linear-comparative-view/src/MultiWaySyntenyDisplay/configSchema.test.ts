import { applyConfSettings, readConfObject } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { FEATURE_NAME_FIELD } from '@jbrowse/plugin-features'

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

test('the lanes take no rows.tree: a config loads without it, naming it, and a write refuses it', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const loaded = make({ rows: { sort: ['b', 'a'], tree: '(b,a);' } })
  expect(getSnapshot(loaded.rows)).toEqual({ sort: ['b', 'a'] })
  expect(warn.mock.calls.flat().join(' ')).toMatch(/tree/)
  warn.mockRestore()
  expect(
    applyConfSettings(make(), { rows: { tree: '(b,a);' } }).failed,
  ).toEqual([expect.objectContaining({ key: 'rows' })])
})
