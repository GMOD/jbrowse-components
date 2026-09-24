import { destroy, types } from '@jbrowse/mobx-state-tree'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'
import { autorun } from 'mobx'

import { workCensus } from './workCensus.ts'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const Rows = types
  .model('Rows', { names: types.array(types.string), label: '' })
  .views(self => ({
    get rowAlias() {
      const samples = new Set(self.names.map(name => name.split(' ')[0]!))
      return (name: string) => {
        const sample = name.split(' ')[0]!
        return samples.has(sample) ? sample : undefined
      }
    },
  }))
  .views(self => ({
    get editableSources() {
      return self.names.map(name => ({ name, sample: self.rowAlias(name) }))
    },
  }))
  .views(self => ({
    get clusterableSources() {
      return self.editableSources
    },
  }))
  .views(self => ({
    get sources() {
      return self.clusterableSources.map(row => ({ ...row, label: self.label }))
    },
  }))
  .actions(self => ({
    setNames(names: string[]) {
      self.names.replace(names)
    },
    setLabel(label: string) {
      self.label = label
    },
  }))

const cells = (table: string) =>
  table.split('\n').map(line => line.replaceAll(/\s+/g, ' '))

test('counts recomputes, alias calls and named reaction runs, never reads', async () => {
  const rows = Rows.create()
  namedAutorun(rows, () => void rows.sources, { name: 'Rows:draw' })
  const unnamed = autorun(() => void rows.sources)
  const table = await workCensus(rows, [
    {
      name: 'rows land',
      run: () => {
        rows.setNames(['a HP0', 'a HP1', 'b'])
      },
    },
    {
      name: 'relabel',
      run: () => {
        rows.setLabel('x')
      },
    },
    {
      name: 'read twice',
      run: () => {
        void rows.sources
        void rows.editableSources
      },
    },
  ])
  unnamed()
  destroy(rows)
  expect(cells(table)).toEqual([
    'rows land arrange 1 (3 rows) alias 3 clusterable 1 sources 1 Rows:draw 1',
    'relabel arrange 0 alias 0 clusterable 0 sources 1 Rows:draw 1',
    'read twice arrange 0 alias 0 clusterable 0 sources 0 -',
  ])
})

test('an alias held from before the census fails the step it went uncounted in', async () => {
  const rows = Rows.create({ names: ['a HP0', 'b'] })
  namedAutorun(rows, () => void rows.sources, { name: 'Rows:draw' })
  await expect(
    workCensus(rows, [
      {
        name: 'relabel',
        run: () => {
          rows.setLabel('x')
        },
      },
    ]),
  ).rejects.toThrow(/went uncounted/)
  destroy(rows)
})
