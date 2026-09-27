import { types } from '@jbrowse/mobx-state-tree'

import { isSyntenyTrack } from './getSyntenyTracks.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const CATEGORIES: Record<string, string> = {
  PAFAdapter: 'Synteny adapters',
  GbzBaseSyntenyAdapter: 'Synteny adapters',
  RgfaTabixAdapter: 'Graph adapters',
}

const pluginManager = {
  hasAdapterType: (name: string) => name in CATEGORIES,
  getAdapterType: (name: string) => ({
    adapterMetadata: { category: CATEGORIES[name] },
  }),
}

const TrackConf = types.model({
  type: types.string,
  adapter: types.frozen<{ type: string }>(),
})

const track = (type: string, adapterType: string) =>
  TrackConf.create(
    { type, adapter: { type: adapterType } },
    { pluginManager },
  ) as unknown as AnyConfigurationModel

test('a SyntenyTrack is a synteny track', () => {
  expect(isSyntenyTrack(track('SyntenyTrack', 'PAFAdapter'))).toBe(true)
})

test('a graph track over a gbz-base database is a synteny track', () => {
  expect(isSyntenyTrack(track('GraphTrack', 'GbzBaseSyntenyAdapter'))).toBe(
    true,
  )
})

test('a graph track over rGFA segments is not', () => {
  expect(isSyntenyTrack(track('GraphTrack', 'RgfaTabixAdapter'))).toBe(false)
})

test('an adapter no plugin registers is not', () => {
  expect(isSyntenyTrack(track('FeatureTrack', 'MissingAdapter'))).toBe(false)
})

test('a plain object is judged by its type alone', () => {
  const plain = {
    type: 'FeatureTrack',
    adapter: { type: 'PAFAdapter' },
  } as unknown as AnyConfigurationModel
  expect(isSyntenyTrack(plain)).toBe(false)
})
