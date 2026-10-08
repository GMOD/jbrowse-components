import { types } from '@jbrowse/mobx-state-tree'

import { heldColorSlots } from './heldColorSlots.ts'

const Track = types.model({
  configuration: types.frozen<{ trackId: string }>(),
  display: types.optional(types.model({}), {}),
})
const Session = types.model({
  configuration: types.frozen({}),
  rpcManager: types.frozen({}),
  views: types.array(types.model({ tracks: types.array(Track) })),
})

function session(trackIds: string[][]) {
  return Session.create({
    views: trackIds.map(ids => ({
      tracks: ids.map(trackId => ({ configuration: { trackId } })),
    })),
  })
}

const biotype = { field: 'biotype', scale: 'categorical' as const }

test('every track coloring by one field deals into one set of slots', () => {
  const s = session([['genes'], ['genes', 'orthologs']])
  const [a, b] = s.views
  const one = heldColorSlots(a!.tracks[0]!.display, biotype)
  expect(one).toBeDefined()
  expect(heldColorSlots(b!.tracks[0]!.display, biotype)).toBe(one)
  expect(heldColorSlots(b!.tracks[1]!.display, biotype)).toBe(one)
})

test('a color object naming another domain or range deals afresh', () => {
  const display = session([['genes']]).views[0]!.tracks[0]!.display
  const one = heldColorSlots(display, biotype)
  expect(heldColorSlots(display, { ...biotype, domain: ['x'] })).not.toBe(one)
  expect(heldColorSlots(display, { ...biotype, range: ['red'] })).not.toBe(one)
  expect(heldColorSlots(display, { ...biotype, field: 'source' })).not.toBe(one)
})

test('each session holds its own', () => {
  const a = session([['genes']]).views[0]!.tracks[0]!.display
  const b = session([['genes']]).views[0]!.tracks[0]!.display
  expect(heldColorSlots(a, biotype)).not.toBe(heldColorSlots(b, biotype))
})

test('only a categorical color deals', () => {
  const display = session([['genes']]).views[0]!.tracks[0]!.display
  expect(heldColorSlots(display, 'red')).toBeUndefined()
  expect(
    heldColorSlots(display, { field: 'score', scale: 'linear' }),
  ).toBeUndefined()
})
