import { destroy, types } from '@jbrowse/mobx-state-tree'

import { isUsableTrackConfig } from './util.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TestTrack = types.model('TestTrack', { trackId: types.string })

const asConf = (conf: unknown) => conf as AnyConfigurationModel

// The crash this guards: a config track is a plain frozen object, and `isAlive`
// throws "Value [object Object] is no MST Node" on one rather than returning
// false. Selecting a whole category ran the selection through that and took the
// track selector down with it.
test('a plain config object is usable and does not throw', () => {
  expect(isUsableTrackConfig(asConf({ trackId: 'volvox_gc' }))).toBe(true)
})

test('a live config node is usable', () => {
  expect(isUsableTrackConfig(asConf(TestTrack.create({ trackId: 'a' })))).toBe(
    true,
  )
})

test('a destroyed config node is dropped', () => {
  const conf = TestTrack.create({ trackId: 'a' })
  destroy(conf)
  expect(isUsableTrackConfig(asConf(conf))).toBe(false)
})
