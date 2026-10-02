import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import {
  ConfigurationReference,
  ConfigurationSchema,
} from '../configuration/index.ts'
import TrackType from '../pluggableElementTypes/TrackType.ts'
import { DEFAULT_CANONICAL_TRANSCRIPTS } from '../util/isoformRank.ts'
import { ElementId } from '../util/types/mst.ts'
import { stateModelFactory } from './stateModelFactory.ts'

const trackTags = { field: 'canonical', tags: ['yes'] }

function setup(displays: { ranksIsoforms: boolean }[]) {
  const pluginManager = new PluginManager()
  const trackConfigSchema = ConfigurationSchema(
    'TestTrack',
    {},
    { explicitIdentifier: 'trackId', explicitlyTyped: true },
  )
  const Display = types.model('TestDisplay', {
    ranksIsoforms: types.boolean,
  })
  const RankingDisplay = Display.views(() => ({
    get canonicalTranscripts() {
      return trackTags
    },
  }))
  const trackStateModel = types.model('TestTrack', {
    id: ElementId,
    type: types.literal('TestTrack'),
    configuration: ConfigurationReference(trackConfigSchema),
    displays: types.array(
      types.union(
        {
          dispatcher: (snap: { ranksIsoforms: boolean }) =>
            snap.ranksIsoforms ? RankingDisplay : Display,
        },
        RankingDisplay,
        Display,
      ),
    ),
  })
  pluginManager.addTrackType(
    () =>
      new TrackType({
        name: 'TestTrack',
        configSchema: trackConfigSchema,
        stateModel: trackStateModel,
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const Session = types
    .model({
      rpcManager: types.optional(types.frozen(), {}),
      configuration: ConfigurationSchema('test', {}),
      tracks: types.array(trackConfigSchema),
      trackModels: types.array(trackStateModel),
      widget: stateModelFactory(pluginManager),
    })
    .views(self => ({
      getTrackById(id: string) {
        return self.tracks.find(t => t.trackId === id)
      },
    }))
    .actions(self => ({
      open() {
        self.widget = {
          id: self.widget.id,
          type: 'BaseFeatureWidget',
          track: self.trackModels[0],
        } as never
      },
      closeTrack() {
        self.trackModels.clear()
      },
    }))

  const session = Session.create(
    {
      tracks: [{ trackId: 't', type: 'TestTrack' }],
      trackModels: [
        { id: 'track1', type: 'TestTrack', configuration: 't', displays },
      ],
      widget: { type: 'BaseFeatureWidget' },
    },
    { pluginManager },
  )
  session.open()
  return session
}

test('the widget reads the tags of the display that ranks isoforms', () => {
  const session = setup([{ ranksIsoforms: false }, { ranksIsoforms: true }])
  expect(session.widget.canonicalTranscripts).toEqual(trackTags)
})

test('a track whose displays rank nothing falls back to the defaults', () => {
  const session = setup([{ ranksIsoforms: false }])
  expect(session.widget.canonicalTranscripts).toBe(
    DEFAULT_CANONICAL_TRANSCRIPTS,
  )
})

test('a closed track falls back to the defaults', () => {
  const session = setup([{ ranksIsoforms: true }])
  session.closeTrack()
  expect(session.widget.canonicalTranscripts).toBe(
    DEFAULT_CANONICAL_TRANSCRIPTS,
  )
})
