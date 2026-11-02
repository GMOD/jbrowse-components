import {
  applyConfSettings,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'

import { configSchemaFactory } from './configSchema.ts'

const schema = configSchemaFactory()

const GROUPS = [
  { match: '^(mom|dad)$', group: 'parents' },
  { match: '^s', group: 'children' },
]

function arranged(displayId: string) {
  return schema.create({
    displayId,
    rows: { field: 'source', sort: ['s2', 'mom'], groups: GROUPS },
  })
}

function warningsOf(load: () => unknown) {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  load()
  const warnings = spy.mock.calls.map(([message]) => message)
  spy.mockRestore()
  return warnings
}

test('rows.groups reads back as written', () => {
  expect(readConfObject(arranged('read'), ['rows', 'groups'])).toEqual(GROUPS)
})

test('a field written as a member keeps the groups and drops the order', () => {
  const conf = arranged('member')
  setConf(conf, ['rows', 'field'], 'sample')
  expect(readConfObject(conf, ['rows', 'sort'])).toEqual([])
  expect(readConfObject(conf, ['rows', 'groups'])).toEqual(GROUPS)
})

test('a bag writing another field keeps the groups and drops the order', () => {
  const conf = arranged('bag')
  applyConfSettings(conf, { rows: 'sample' })
  expect(readConfObject(conf, ['rows', 'field'])).toBe('sample')
  expect(readConfObject(conf, ['rows', 'sort'])).toEqual([])
  expect(readConfObject(conf, ['rows', 'groups'])).toEqual(GROUPS)
})

test('rowGroups loads without it and points at rows.groups', () => {
  expect(
    warningsOf(() =>
      schema.create({ displayId: 'old', rows: 'source', rowGroups: GROUPS }),
    ),
  ).toEqual([
    'LinearMarkDisplay "old" does not declare rowGroups: loading without it — did you mean rows.groups?',
  ])
})
