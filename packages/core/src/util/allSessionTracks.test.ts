import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/index.ts'
import TrackType from '../pluggableElementTypes/TrackType.ts'
import { createBaseTrackConfig } from '../pluggableElementTypes/models/index.ts'
import { allSessionTracks } from './tracks.ts'

import type { TrackConfigEntry } from '../configuration/index.ts'

const track = (trackId: string): TrackConfigEntry => ({
  trackId,
  type: 'FeatureTrack',
})

function connectionTrackFactory() {
  const pluginManager = new PluginManager()
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
  const TrackConfig = pluginManager.pluggableConfigSchemaType('track')
  return (trackId: string) =>
    TrackConfig.create({ trackId, type: 'FeatureTrack' }, { pluginManager })
}

const connectionTrack = connectionTrackFactory()

test('connection tracks are included, so a hub track is visible', () => {
  const b = connectionTrack('b')
  expect(
    allSessionTracks({
      tracks: [track('a')],
      connectionInstances: [{ tracks: [b] }],
    }),
  ).toEqual([track('a'), b])
})

test('every connection contributes', () => {
  const b = connectionTrack('b')
  const c = connectionTrack('c')
  expect(
    allSessionTracks({
      tracks: [],
      connectionInstances: [{ tracks: [b] }, { tracks: [c] }],
    }),
  ).toEqual([b, c])
})

test('session tracks are not doubled', () => {
  // session.tracks already contains sessionTracks, so callers must not union
  // those two themselves
  const tracks = [track('session'), track('config')]
  expect(allSessionTracks({ tracks })).toEqual(tracks)
})

test('a session without connections is passed through by identity', () => {
  // keeps the hydration cache warm for the common case (see SessionTracks)
  const tracks = [track('a')]
  expect(allSessionTracks({ tracks })).toBe(tracks)
  expect(allSessionTracks({ tracks, connectionInstances: [] })).toBe(tracks)
})
