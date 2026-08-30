import { types } from '@jbrowse/mobx-state-tree'

import PluginManager from '../PluginManager.ts'
import {
  ConfigurationReference,
  ConfigurationSchema,
  FormatDetailsConfigSchemaFactory,
} from '../configuration/index.ts'
import TrackType from '../pluggableElementTypes/TrackType.ts'
import { ElementId } from '../util/types/mst.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type {
  SimpleFeatureSerialized,
  SimpleFeatureSerializedNoId,
} from '../util/index.ts'

// `formatDetails` exists at two tiers: on a track, and session-wide under
// `configuration.formatDetails`. These cover how the two combine, which is the
// part a config author cannot see from either schema on its own.
//
// A stub track state model rather than `createBaseTrackModel`: the widget's
// autorun reads exactly `track.type` and `track.configuration`, and the stub
// still carries the real `formatDetails` schema, which is the thing under test.
function setup({
  sessionFormatDetails,
  trackFormatDetails,
}: {
  sessionFormatDetails?: Record<string, unknown>
  trackFormatDetails?: Record<string, unknown>
}) {
  const pluginManager = new PluginManager()
  const trackConfigSchema = ConfigurationSchema(
    'TestTrack',
    { formatDetails: FormatDetailsConfigSchemaFactory() },
    { explicitIdentifier: 'trackId', explicitlyTyped: true },
  )
  const trackStateModel = types.model('TestTrack', {
    id: ElementId,
    type: types.literal('TestTrack'),
    configuration: ConfigurationReference(trackConfigSchema),
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
      configuration: ConfigurationSchema('test', {
        formatDetails: FormatDetailsConfigSchemaFactory(),
      }),
      tracks: types.array(trackConfigSchema),
      trackModels: types.array(trackStateModel),
      widget: stateModelFactory(pluginManager),
    })
    .views(self => ({
      // what a `trackId` ConfigurationReference resolves through
      getTrackById(id: string) {
        return self.tracks.find(t => t.trackId === id)
      },
    }))

  return Session.create(
    {
      configuration: { formatDetails: sessionFormatDetails ?? {} },
      tracks: trackFormatDetails
        ? [
            {
              trackId: 'testtrack',
              type: 'TestTrack',
              formatDetails: trackFormatDetails,
            },
          ]
        : [],
      trackModels: trackFormatDetails
        ? [{ id: 'track1', type: 'TestTrack', configuration: 'testtrack' }]
        : [],
      widget: {
        type: 'BaseFeatureWidget',
        ...(trackFormatDetails ? { track: 'track1' } : {}),
      },
    },
    { pluginManager },
  )
}

const feature: SimpleFeatureSerialized = {
  uniqueId: 'f1',
  refName: 'ctgA',
  start: 2,
  end: 102,
  name: 'gene1',
  subfeatures: [
    {
      refName: 'ctgA',
      start: 2,
      end: 102,
      type: 'mRNA',
      name: 'level1',
      subfeatures: [
        {
          refName: 'ctgA',
          start: 2,
          end: 52,
          type: 'exon',
          name: 'level2',
          subfeatures: [
            { refName: 'ctgA', start: 2, end: 20, type: 'CDS', name: 'level3' },
          ],
        },
      ],
    },
  ],
}

// the __jbrowsefmt the callbacks left on the Nth nested subfeature
function fmtAtDepth(
  feat: SimpleFeatureSerializedNoId | undefined,
  depth: number,
) {
  let cur = feat
  for (let i = 0; i < depth; i++) {
    cur = cur?.subfeatures?.[0]
  }
  return cur?.__jbrowsefmt
}

test('the track object is spread over the session object', () => {
  const model = setup({
    sessionFormatDetails: {
      feature: "jexl:{fromSession:'global', shared:'session wins nothing'}",
    },
    trackFormatDetails: { feature: "jexl:{shared:'track', fromTrack:'local'}" },
  })
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData?.__jbrowsefmt).toEqual({
    fromSession: 'global',
    fromTrack: 'local',
    shared: 'track',
  })
})

// depth and maxDepth are `maybeNumber` precisely so this works. As plain number
// slots the track read back its own default whether or not anyone set it, so a
// session-wide value could never reach a track, and every real config has one.
test('session depth applies to a track that does not set its own', () => {
  const model = setup({
    sessionFormatDetails: {
      subfeatures: "jexl:{note:'formatted ' + feature.name}",
      depth: 3,
    },
    trackFormatDetails: {},
  })
  model.widget.setFeatureData(feature)
  const { featureData } = model.widget
  expect(fmtAtDepth(featureData, 1)).toEqual({ note: 'formatted level1' })
  expect(fmtAtDepth(featureData, 2)).toEqual({ note: 'formatted level2' })
  // the old default of 2 would have stopped here
  expect(fmtAtDepth(featureData, 3)).toEqual({ note: 'formatted level3' })
})

test('a track depth overrides the session, in both directions', () => {
  const deeper = setup({
    sessionFormatDetails: { subfeatures: 'jexl:{note:feature.name}' },
    trackFormatDetails: { depth: 3 },
  })
  deeper.widget.setFeatureData(feature)
  expect(fmtAtDepth(deeper.widget.featureData, 3)).toEqual({ note: 'level3' })

  // a track asking for less than the session gets less: the reason these
  // override rather than combining monotonically
  const shallower = setup({
    sessionFormatDetails: {
      subfeatures: 'jexl:{note:feature.name}',
      depth: 3,
    },
    trackFormatDetails: { depth: 1 },
  })
  shallower.widget.setFeatureData(feature)
  expect(fmtAtDepth(shallower.widget.featureData, 1)).toEqual({
    note: 'level1',
  })
  expect(fmtAtDepth(shallower.widget.featureData, 2)).toBeUndefined()
})

// maxDepth is the render limit the panel reads, not a format depth
test('session maxDepth reaches a track, and the track overrides it', () => {
  const fromSession = setup({
    sessionFormatDetails: { maxDepth: 1 },
    trackFormatDetails: {},
  })
  fromSession.widget.setFeatureData(feature)
  expect(fromSession.widget.maxDepth).toBe(1)

  const fromTrack = setup({
    sessionFormatDetails: { maxDepth: 1 },
    trackFormatDetails: { maxDepth: 3 },
  })
  fromTrack.widget.setFeatureData(feature)
  expect(fromTrack.widget.maxDepth).toBe(3)
})

test('maxDepth is unset when neither tier sets one', () => {
  const model = setup({ trackFormatDetails: {} })
  model.widget.setFeatureData(feature)
  // unset is the meaningful value here: the panel reads it as no limit
  expect(model.widget.maxDepth).toBeUndefined()
})

// a config with no formatDetails at all leaves the feature exactly as it came
// in, rather than stamping empty objects through the persisted snapshot
test('no callbacks anywhere attaches no __jbrowsefmt', () => {
  const pluginManager = new PluginManager()
  const Session = types.model({
    rpcManager: types.optional(types.frozen(), {}),
    configuration: ConfigurationSchema('test', {}),
    widget: stateModelFactory(pluginManager),
  })
  const model = Session.create(
    { widget: { type: 'BaseFeatureWidget' } },
    { pluginManager },
  )
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData?.__jbrowsefmt).toBeUndefined()
  expect(fmtAtDepth(model.widget.featureData, 1)).toBeUndefined()
})

// `jexl:feature.name` where `jexl:{name:feature.name}` was meant. Spreading the
// resulting string used to produce attribute rows keyed 0, 1, 2.
test('a callback returning something other than an object is dropped', () => {
  const model = setup({
    sessionFormatDetails: { feature: 'jexl:feature.name' },
    trackFormatDetails: { feature: "jexl:{kept:'yes'}" },
  })
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData?.__jbrowsefmt).toEqual({ kept: 'yes' })
})

test('a static object needs no jexl at all', () => {
  const model = setup({
    trackFormatDetails: { feature: { Source: 'GENCODE v44' } },
  })
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData?.__jbrowsefmt).toEqual({
    Source: 'GENCODE v44',
  })
})

test('a broken callback reports which track to look at', () => {
  const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
  const model = setup({ trackFormatDetails: { feature: 'jexl:{{{' } })
  model.widget.setFeatureData(feature)
  expect(`${model.widget.error}`).toContain('testtrack')
  expect(`${reported.mock.calls[0]?.[0]}`).toContain('testtrack')
  reported.mockRestore()
})

// The clone and the per-subfeature walk are both proportional to the subfeature
// tree, and both produce nothing when neither tier declares a callback -- which
// is what nearly every real config looks like. Identity is the observable half
// of skipping them: `applyFormatDetails` hands the feature straight back rather
// than returning a structural copy of it.
test('a config declaring no callbacks does not copy the feature', () => {
  const model = setup({})
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData).toBe(feature)
  expect(model.widget.featureData?.__jbrowsefmt).toBeUndefined()
})

// The skip is per-slot, so declaring one does not pay for the other: a
// `feature` callback formats the top level without walking the tree.
test('declaring only a feature callback leaves subfeatures unwalked', () => {
  const model = setup({ trackFormatDetails: { feature: "jexl:{a:'b'}" } })
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData).not.toBe(feature)
  expect(model.widget.featureData?.__jbrowsefmt).toEqual({ a: 'b' })
  expect(fmtAtDepth(model.widget.featureData, 1)).toBeUndefined()
})

// ...and the reverse: subfeatures format without a top-level callback.
test('declaring only a subfeatures callback still formats subfeatures', () => {
  const model = setup({ trackFormatDetails: { subfeatures: "jexl:{c:'d'}" } })
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData?.__jbrowsefmt).toBeUndefined()
  expect(fmtAtDepth(model.widget.featureData, 1)).toEqual({ c: 'd' })
})
