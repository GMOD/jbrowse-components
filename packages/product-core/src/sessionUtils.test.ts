import {
  getRoot,
  getType,
  resolveIdentifier,
  types,
  unprotect,
} from '@jbrowse/mobx-state-tree'
import { runInAction } from 'mobx'

import { addRelativeUris, filterSessionInPlace } from './sessionUtils.ts'

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

test('addRelativeUris stamps baseUri next to a uri key', () => {
  const config: Record<string, unknown> = { uri: 'data.bam' }
  addRelativeUris(config, new URL('https://example.com/config/'))
  expect(config.baseUri).toBe('https://example.com/config/')
})

test('addRelativeUris recurses into nested objects and arrays', () => {
  const config: Record<string, unknown> = {
    adapter: { uri: 'data.bam' },
    tracks: [{ uri: 'a.bam' }, { uri: 'b.bam' }],
  }
  addRelativeUris(config, new URL('https://example.com/'))
  expect((config.adapter as Record<string, unknown>).baseUri).toBe(
    'https://example.com/',
  )
  expect(
    (config.tracks as Record<string, unknown>[]).map(t => t.baseUri),
  ).toEqual(['https://example.com/', 'https://example.com/'])
})

// preserve-existing is the behavior that differed from the (now-deleted)
// data-management copy, which overwrote unconditionally
test('addRelativeUris preserves an existing baseUri', () => {
  const config: Record<string, unknown> = {
    uri: 'data.bam',
    baseUri: 'https://other.com/',
  }
  addRelativeUris(config, new URL('https://example.com/config/'))
  expect(config.baseUri).toBe('https://other.com/')
})

test('addRelativeUris tolerates null', () => {
  expect(() => {
    addRelativeUris(null, new URL('https://example.com/'))
  }).not.toThrow()
})
