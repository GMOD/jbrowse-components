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
// A stub track state model rather than `createBaseTrackModel`: the widget reads
// exactly `track.type` and `track.configuration`, and the stub still carries
// the real `formatDetails` schema, which is the thing under test.
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
    {
      name: { type: 'string', defaultValue: '' },
      formatDetails: FormatDetailsConfigSchemaFactory(),
    },
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
    .actions(self => ({
      closeTrack() {
        self.trackModels.clear()
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
              name: 'Test track',
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

// the Nth nested subfeature as the panel shows it
function atDepth(feat: SimpleFeatureSerializedNoId | undefined, depth: number) {
  let cur = feat
  for (let i = 0; i < depth; i++) {
    cur = cur?.subfeatures?.[0]
  }
  return cur
}

test('the track object is spread over the session object', () => {
  const model = setup({
    sessionFormatDetails: {
      feature: "jexl:{fromSession:'global', shared:'session wins nothing'}",
    },
    trackFormatDetails: { feature: "jexl:{shared:'track', fromTrack:'local'}" },
  })
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData).toMatchObject({
    name: 'gene1',
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
  expect(atDepth(featureData, 1)?.note).toBe('formatted level1')
  expect(atDepth(featureData, 2)?.note).toBe('formatted level2')
  // the default of 2 would have stopped here
  expect(atDepth(featureData, 3)?.note).toBe('formatted level3')
})

test('a track depth overrides the session, in both directions', () => {
  const deeper = setup({
    sessionFormatDetails: { subfeatures: 'jexl:{note:feature.name}' },
    trackFormatDetails: { depth: 3 },
  })
  deeper.widget.setFeatureData(feature)
  expect(atDepth(deeper.widget.featureData, 3)?.note).toBe('level3')

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
  expect(atDepth(shallower.widget.featureData, 1)?.note).toBe('level1')
  expect(atDepth(shallower.widget.featureData, 2)?.note).toBeUndefined()
})

// maxDepth is the render limit the panel reads, not a format depth
test('session maxDepth reaches a track, and the track overrides it', () => {
  const fromSession = setup({
    sessionFormatDetails: { maxDepth: 1 },
    trackFormatDetails: {},
  })
  expect(fromSession.widget.maxDepth).toBe(1)

  const fromTrack = setup({
    sessionFormatDetails: { maxDepth: 1 },
    trackFormatDetails: { maxDepth: 3 },
  })
  expect(fromTrack.widget.maxDepth).toBe(3)
})

test('maxDepth is unset when neither tier sets one', () => {
  const model = setup({ trackFormatDetails: {} })
  // unset is the meaningful value here: the panel reads it as no limit
  expect(model.widget.maxDepth).toBeUndefined()
})

// The walk is proportional to the subfeature tree and produces nothing when
// neither tier declares a callback, which is what nearly every real config
// looks like. Identity is the observable half of skipping it.
test('a config declaring no callbacks hands the feature back as is', () => {
  const model = setup({})
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData).toBe(feature)
})

test('declaring only a feature callback leaves subfeatures unwalked', () => {
  const model = setup({ trackFormatDetails: { feature: "jexl:{a:'b'}" } })
  model.widget.setFeatureData(feature)
  const { featureData } = model.widget
  expect(featureData).not.toBe(feature)
  expect(featureData?.a).toBe('b')
  expect(atDepth(featureData, 1)).toBe(feature.subfeatures![0])
})

test('declaring only a subfeatures callback still formats subfeatures', () => {
  const model = setup({ trackFormatDetails: { subfeatures: "jexl:{c:'d'}" } })
  model.widget.setFeatureData(feature)
  const { featureData } = model.widget
  expect(Object.keys(featureData!)).toEqual(Object.keys(feature))
  expect(atDepth(featureData, 1)?.c).toBe('d')
  expect(atDepth(featureData, 3)?.c).toBeUndefined()
})

test('a static object needs no jexl at all', () => {
  const model = setup({
    trackFormatDetails: { feature: { Source: 'GENCODE v44' } },
  })
  model.widget.setFeatureData(feature)
  expect(model.widget.featureData?.Source).toBe('GENCODE v44')
})

// what a callback can ask beyond the feature itself: the track it is on, and
// for a subfeature, the feature it sits in and how far down
test('callbacks see the track, and subfeature callbacks their parent and depth', () => {
  const model = setup({
    sessionFormatDetails: {
      feature: 'jexl:{onTrack:track.name}',
      subfeatures: 'jexl:{onTrack:track.name, within:parent.name, level:depth}',
    },
    trackFormatDetails: {},
  })
  model.widget.setFeatureData(feature)
  const { featureData } = model.widget
  expect(featureData?.onTrack).toBe('Test track')
  expect(atDepth(featureData, 1)).toMatchObject({
    onTrack: 'Test track',
    within: 'gene1',
    level: 1,
  })
  expect(atDepth(featureData, 2)).toMatchObject({
    within: 'level1',
    level: 2,
  })
})

// The widget's `track` is a safeReference to the track's state model, which a
// closed track no longer has. The track's config still exists, so its callbacks
// still apply.
test('closing the track keeps the track tier applied', () => {
  const model = setup({
    sessionFormatDetails: { feature: "jexl:{fromSession:'global'}" },
    trackFormatDetails: { feature: "jexl:{fromTrack:'local'}" },
  })
  model.widget.setFeatureData(feature)
  model.closeTrack()
  expect(model.widget.track).toBeUndefined()
  expect(model.widget.trackId).toBe('testtrack')
  expect(model.widget.featureData).toMatchObject({
    fromSession: 'global',
    fromTrack: 'local',
  })
})

// `jexl:feature.name` where `jexl:{name:feature.name}` was meant. Spread, the
// string produced attribute rows keyed 0, 1, 2; dropped, it did nothing
test('a callback returning something other than an object is an error', () => {
  const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
  const model = setup({
    sessionFormatDetails: { feature: 'jexl:feature.name' },
    trackFormatDetails: {},
  })
  model.widget.setFeatureData(feature)
  expect(`${model.widget.error}`).toContain('returned a string')
  expect(model.widget.featureData).toBeUndefined()
  reported.mockRestore()
})

test('a broken session callback names the session, not the track', () => {
  const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
  const model = setup({
    sessionFormatDetails: { feature: 'jexl:feature.name' },
    trackFormatDetails: {},
  })
  model.widget.setFeatureData(feature)
  expect(`${model.widget.error}`).toContain('the session configuration')
  expect(`${model.widget.error}`).not.toContain('testtrack')
  reported.mockRestore()
})

test('a broken callback reports which track to look at', () => {
  const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
  const model = setup({ trackFormatDetails: { feature: 'jexl:{{{' } })
  model.widget.setFeatureData(feature)
  expect(`${model.widget.error}`).toContain('testtrack')
  expect(`${reported.mock.calls[0]?.[0]}`).toContain('testtrack')
  reported.mockRestore()
})
