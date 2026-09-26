import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'

import GCContentPlugin from '../index.ts'
import { liftGCSettings } from './liftGCSettings.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

function makePluginManager() {
  const pluginManager = new PluginManager([
    new LinearGenomeViewPlugin(),
    new WigglePlugin(),
    new GCContentPlugin(),
  ])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

function trackConfig(
  pluginManager: PluginManager,
  snapshot: Record<string, unknown>,
) {
  return pluginManager
    .pluggableConfigSchemaType('track')
    .create(
      { trackId: 'gc', assemblyNames: ['volvox'], ...snapshot },
      { pluginManager },
    )
}

async function createTrack(adapter: Record<string, unknown> = {}) {
  const pluginManager = makePluginManager()
  await pluginManager.getDisplayType('LinearWiggleDisplay').loadStateModel()
  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const conf = trackConfig(pluginManager, {
    type: 'GCContentTrack',
    adapter: {
      type: 'GCContentAdapter',
      sequenceAdapter: { type: 'IndexedFastaAdapter' },
      ...adapter,
    },
  })
  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: jest.fn() },
      assemblyManager: { get: () => ({ initialized: true }) },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'gc' ? conf : undefined
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
    }))
  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'GCContentTrack',
          configuration: 'gc',
          displays: [{ type: 'LinearWiggleDisplay' }],
        },
      ],
    }),
  )
  const track = view.tracks[0]!
  return { track, display: track.displays[0]! }
}

test('the window, step and mode live on the adapter, and each refetches', async () => {
  const { track, display } = await createTrack()
  const initial = display.settingsFetchInputs
  track.setGCMode('skew')
  expect(readConfObject(track.configuration.adapter, 'gcMode')).toBe('skew')
  expect(display.settingsFetchInputs).not.toEqual(initial)
  const afterMode = display.settingsFetchInputs
  track.setGCContentParams({ windowSize: 50, windowDelta: 10 })
  expect(display.adapterConfig).toMatchObject({
    type: 'GCContentAdapter',
    gcMode: 'skew',
    windowSize: 50,
    windowDelta: 10,
  })
  expect(display.settingsFetchInputs).not.toEqual(afterMode)
})

test('a step never outlives a window shrunk below it', async () => {
  const { track } = await createTrack()
  track.setGCContentParams({ windowSize: 1000, windowDelta: 1000 })
  track.setGCContentParams({ windowSize: 20 })
  expect([track.windowSize, track.windowDelta]).toEqual([20, 20])
  track.setGCContentParams({ windowSize: 500, windowDelta: 25 })
  track.setGCContentParams({ windowSize: 400 })
  expect(track.windowDelta).toBe(25)
})

test('the track menu carries the GC parameters beside the plot', async () => {
  const { track } = await createTrack()
  const labels = (track.trackMenuItems() as { label?: string }[]).map(
    i => i.label,
  )
  expect(labels).toEqual(
    expect.arrayContaining(['GC parameters', 'GC skew', 'Score']),
  )
})

test("content's axis is the fraction's own [0, 1], skew's follows the data", async () => {
  const { display } = await createTrack()
  const region = {
    refName: 'ctgA',
    start: 0,
    end: 1000,
    assemblyName: 'volvox',
  }
  display.setRpcData(0, { sources: [], valueDomain: [0, 1] }, region)
  expect([display.minScoreBound, display.maxScoreBound]).toEqual([0, 1])
  display.setMaxScore(0.75)
  expect([display.minScoreBound, display.maxScoreBound]).toEqual([0, 0.75])
  display.setRpcData(0, { sources: [] }, region)
  display.setMaxScore(undefined)
  expect([display.minScoreBound, display.maxScoreBound]).toEqual([
    undefined,
    undefined,
  ])
})

test("v4's GC display settings land on the adapter, and a bare sequence adapter is wrapped", () => {
  const pluginManager = makePluginManager()
  const conf = trackConfig(pluginManager, {
    type: 'GCContentTrack',
    adapter: { type: 'IndexedFastaAdapter' },
    displays: [
      {
        type: 'LinearGCContentDisplay',
        displayId: 'gc-LinearGCContentDisplay',
        windowSize: 10,
        gcMode: 'skew',
      },
    ],
  })
  expect(readConfObject(conf, ['adapter', 'type'])).toBe('GCContentAdapter')
  expect(readConfObject(conf, ['adapter', 'windowSize'])).toBe(10)
  expect(readConfObject(conf, ['adapter', 'gcMode'])).toBe('skew')
  expect(readConfObject(conf, ['adapter', 'sequenceAdapter'])).toMatchObject({
    type: 'IndexedFastaAdapter',
  })
  const [display] = conf.displays
  expect(display.type).toBe('LinearWiggleDisplay')
  expect(readConfObject(display, 'summaryScoreMode')).toBe('avg')
})

test('displayDefaults GC settings land on the adapter too', () => {
  expect(
    liftGCSettings({
      type: 'GCContentTrack',
      adapter: { type: 'GCContentAdapter' },
      displayDefaults: { gcMode: 'skew', windowSize: 50, height: 80 },
    }),
  ).toMatchObject({
    adapter: { type: 'GCContentAdapter', gcMode: 'skew', windowSize: 50 },
    displayDefaults: { height: 80 },
  })
})

test("a reference sequence track's retired GC display is dropped, its own kept", () => {
  expect(
    liftGCSettings({
      type: 'ReferenceSequenceTrack',
      displays: [
        { type: 'LinearReferenceSequenceDisplay' },
        { type: 'LinearWiggleDisplay', windowSize: 10 },
      ],
    }).displays,
  ).toEqual([{ type: 'LinearReferenceSequenceDisplay' }])
})
