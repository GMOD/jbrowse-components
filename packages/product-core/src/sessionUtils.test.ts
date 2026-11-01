import {
  getRoot,
  getType,
  resolveIdentifier,
  types,
  unprotect,
} from '@jbrowse/mobx-state-tree'
import { runInAction } from 'mobx'

import { filterSessionInPlace } from './sessionUtils.ts'

const Item = types.model('Item', {
  id: types.identifier,
  name: types.string,
})

const Container = types.model('Container', {
  items: types.map(Item),
  refs: types.map(types.reference(Item)),
})

test('filterSessionInPlace removes stale references from maps', () => {
  const container = Container.create({
    items: { a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' } },
    refs: { a: 'a', b: 'b' },
  })
  unprotect(container)
  runInAction(() => {
    container.items.delete('b')
    filterSessionInPlace(container, getType(container))
  })
  expect([...container.refs.keys()]).toEqual(['a'])
})

const ArrayContainer = types.model('ArrayContainer', {
  items: types.map(Item),
  refs: types.array(types.reference(Item)),
})

test('filterSessionInPlace removes stale references from arrays', () => {
  const container = ArrayContainer.create({
    items: { a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' } },
    refs: ['a', 'b'],
  })
  unprotect(container)
  runInAction(() => {
    container.items.delete('b')
    filterSessionInPlace(container, getType(container))
  })
  expect(container.refs.map(r => r.id)).toEqual(['a'])
})

// A child whose property read throws stands in for an open track whose
// `configuration` reference resolves to a structurally-invalid config and
// fails to hydrate.
const ExplodingChild = types.model('ExplodingChild', {
  id: types.identifier,
  target: types.reference(Item, {
    get(id, parent) {
      const item = resolveIdentifier(Item, getRoot(parent), id)
      if (!item) {
        throw new Error(`cannot hydrate "${id}"`)
      }
      return item
    },
    set(value: { id: string }) {
      return value.id
    },
  }),
})

const ExplodingContainer = types.model('ExplodingContainer', {
  items: types.map(Item),
  children: types.array(ExplodingChild),
})

test('filterSessionInPlace drops an element whose walk throws, keeps the rest', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const container = ExplodingContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: [
      { id: 'good', target: 'a' },
      { id: 'bad', target: 'broken' },
    ],
  })
  unprotect(container)
  runInAction(() => {
    filterSessionInPlace(container, getType(container))
  })
  expect(container.children.map(c => c.id)).toEqual(['good'])
  errorSpy.mockRestore()
})

// The array walk splices in place while iterating; two adjacent bad elements
// must both go without the splice skipping the second.
test('filterSessionInPlace drops multiple adjacent throwing array elements', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const container = ExplodingContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: [
      { id: 'bad1', target: 'x' },
      { id: 'bad2', target: 'y' },
      { id: 'good', target: 'a' },
      { id: 'bad3', target: 'z' },
    ],
  })
  unprotect(container)
  runInAction(() => {
    filterSessionInPlace(container, getType(container))
  })
  expect(container.children.map(c => c.id)).toEqual(['good'])
  errorSpy.mockRestore()
})

const ExplodingMapContainer = types.model('ExplodingMapContainer', {
  items: types.map(Item),
  children: types.map(ExplodingChild),
})

// The map walk deletes keys while iterating map.keys(); several bad entries in a
// row must all be dropped (guards against a concurrent-modification skip).
test('filterSessionInPlace drops multiple throwing map elements', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const container = ExplodingMapContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: {
      bad1: { id: 'bad1', target: 'x' },
      good1: { id: 'good1', target: 'a' },
      bad2: { id: 'bad2', target: 'y' },
      bad3: { id: 'bad3', target: 'z' },
      good2: { id: 'good2', target: 'a' },
    },
  })
  unprotect(container)
  runInAction(() => {
    filterSessionInPlace(container, getType(container))
  })
  expect([...container.children.keys()].sort()).toEqual(['good1', 'good2'])
  errorSpy.mockRestore()
})

// Models a track (resolvable `configuration` reference) whose subtree contains
// a child that throws when instantiated — standing in for a display whose
// afterAttach reads view.width before the view is measured. The walk must
// validate the track via its config reference WITHOUT descending into the
// subtree, so a throwing child can't make a valid track get dropped.
const ConfigBearingChild = types.model('ConfigBearingChild', {
  id: types.identifier,
  configuration: types.reference(Item, {
    get(id, parent) {
      const item = resolveIdentifier(Item, getRoot(parent), id)
      if (!item) {
        throw new Error(`cannot hydrate config "${id}"`)
      }
      return item
    },
    set(value: { id: string }) {
      return value.id
    },
  }),
  // never reached by the walk; throws if it ever is
  subtree: types.array(ExplodingChild),
})

const ConfigBearingContainer = types.model('ConfigBearingContainer', {
  items: types.map(Item),
  children: types.array(ConfigBearingChild),
})

test('filterSessionInPlace validates a config-bearing element by its config, not by walking its subtree', () => {
  const container = ConfigBearingContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: [
      // valid config; a child in its subtree would throw if walked
      {
        id: 'keep',
        configuration: 'a',
        subtree: [{ id: 'boom', target: 'x' }],
      },
    ],
  })
  unprotect(container)
  runInAction(() => {
    filterSessionInPlace(container, getType(container))
  })
  expect(container.children.map(c => c.id)).toEqual(['keep'])
})

test('filterSessionInPlace drops a config-bearing element whose config is dangling and reports it', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const container = ConfigBearingContainer.create({
    items: { a: { id: 'a', name: 'A' } },
    children: [
      { id: 'keep', configuration: 'a' },
      { id: 'drop', configuration: 'missing' },
    ],
  })
  unprotect(container)
  const dropped = runInAction(() =>
    filterSessionInPlace(container, getType(container)),
  )
  expect(container.children.map(c => c.id)).toEqual(['keep'])
  expect(dropped).toEqual([{ type: undefined, configuration: 'missing' }])
  errorSpy.mockRestore()
})
