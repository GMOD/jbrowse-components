import { getType, types, unprotect } from '@jbrowse/mobx-state-tree'

import { filterSessionInPlace } from './util.ts'

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
  container.items.delete('b')
  filterSessionInPlace(container, getType(container))
  expect([...container.refs.keys()]).toEqual(['a'])
})
