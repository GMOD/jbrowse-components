import { readConfObject, setConf } from '@jbrowse/core/configuration'
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

test('the lanes take rows.tree as newick or { newick, provenance }, and a sort keeps it', () => {
  const bare = make({ rows: { sort: ['b', 'a'], tree: '(b,a);' } })
  expect(readConfObject(bare, ['rows', 'tree', 'newick'])).toBe('(b,a);')
  expect(readConfObject(bare, ['rows', 'tree', 'provenance'])).toBeUndefined()

  const full = make({
    rows: { tree: { newick: '(b,a);', provenance: { regions: [] } } },
  })
  setConf(full, ['rows', 'sort'], ['a', 'b'])
  expect(readConfObject(full, ['rows', 'sort'])).toEqual(['a', 'b'])
  expect(readConfObject(full, ['rows', 'tree', 'newick'])).toBe('(b,a);')
  expect(readConfObject(full, ['rows', 'tree', 'provenance'])).toEqual({
    regions: [],
  })
})
