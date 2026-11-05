import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import TextSearchAdapterType from '../pluggableElementTypes/TextSearchAdapterType.ts'
import TrackType from '../pluggableElementTypes/TrackType.ts'
import { createBaseTrackConfig } from '../pluggableElementTypes/models/index.ts'
import {
  ConfigurationSchema,
  hydrateTrackConfig,
  isConfigurationModel,
  readConfObject,
} from './index.ts'

import type { TrackConfigNode } from '../pluggableElementTypes/models/index.ts'

function pluginManagerWithFeatureTrack() {
  const pluginManager = new PluginManager()
  pluginManager.addTextSearchAdapterType(
    () =>
      new TextSearchAdapterType({
        name: 'TrixTextSearchAdapter',
        configSchema: ConfigurationSchema(
          'TrixTextSearchAdapter',
          { uri: { type: 'string', defaultValue: '' } },
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.reject(new Error('not instantiated')),
      }),
  )
  pluginManager.addTrackType(() => {
    const configSchema = ConfigurationSchema(
      'FeatureTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'FeatureTrack',
      configSchema,
      stateModel: types.model('FeatureTrack', {}),
    })
  })
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

function textSearchAdapterOf(conf: TrackConfigNode | undefined) {
  const textSearching = conf?.textSearching
  if (!isConfigurationModel(textSearching)) {
    throw new Error('the track hydrated with no textSearching node')
  }
  return readConfObject(textSearching, 'textSearchAdapter')
}

// products/jbrowse-desktop/src/indexJobsModel.ts used to write a track's
// post-indexing `textSearching` by mutating the frozen conf object already
// sitting in `jbrowse.tracks` in place. This pins why that was never visible
// once the track had already been hydrated once (e.g. to display it) — the
// exact sequence the desktop text-indexing job runs into.
test('mutating a frozen track object in place is invisible to a cached hydration', () => {
  const pluginManager = pluginManagerWithFeatureTrack()
  const frozen: Record<string, unknown> = {
    trackId: 'track-1',
    type: 'FeatureTrack',
    name: 'Track 1',
  }
  // simulate the track already being displayed once, before indexing finishes
  hydrateTrackConfig(pluginManager, frozen)

  // the old, buggy write: same object identity, new nested property
  frozen.textSearching = {
    textSearchAdapter: { type: 'TrixTextSearchAdapter', uri: 'genes.ix' },
  }

  expect(
    textSearchAdapterOf(hydrateTrackConfig(pluginManager, frozen)),
  ).toBeUndefined()
})

test('replacing the track object (new identity) is visible to a fresh hydration', () => {
  const pluginManager = pluginManagerWithFeatureTrack()
  const frozen: Record<string, unknown> = {
    trackId: 'track-1',
    type: 'FeatureTrack',
    name: 'Track 1',
  }
  hydrateTrackConfig(pluginManager, frozen)

  const replaced = {
    ...frozen,
    textSearching: {
      textSearchAdapter: { type: 'TrixTextSearchAdapter', uri: 'genes.ix' },
    },
  }

  expect(
    textSearchAdapterOf(hydrateTrackConfig(pluginManager, replaced)),
  ).toMatchObject({ type: 'TrixTextSearchAdapter', uri: 'genes.ix' })
})
