import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'

import GCContentPlugin from '../index.ts'
import { liftGCSettings } from './liftGCSettings.ts'

import type { GCStep } from '../GCContentAdapter/gcWindow.ts'
import type {
  CheckboxMenuItem,
  RadioMenuItem,
  SubMenuItem,
} from '@jbrowse/core/ui'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearWiggleDisplayModel } from '@jbrowse/plugin-wiggle/LinearWiggleDisplay/stateModel'

interface GCContentTrackMembers {
  op: 'content' | 'skew'
  window: number
  step: GCStep
  setOp: (op: 'content' | 'skew') => void
  setWindow: (window: number) => void
  setStep: (step: GCStep) => void
}

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
  return {
    track: track as typeof track & GCContentTrackMembers,
    display: track.displays[0]! as LinearWiggleDisplayModel,
  }
}

test('the op, window and step live on the adapter, and each refetches', async () => {
  const { track, display } = await createTrack()
  let previous = display.settingsFetchInputs
  for (const write of [
    () => {
      track.setOp('skew')
    },
    () => {
      track.setWindow(50)
    },
    () => {
      track.setStep(10)
    },
  ]) {
    write()
    expect(display.settingsFetchInputs).not.toEqual(previous)
    previous = display.settingsFetchInputs
  }
  expect(display.adapterConfig).toMatchObject({
    type: 'GCContentAdapter',
    op: 'skew',
    window: 50,
    step: 10,
  })
})

test('the step follows the zoom until a fixed one is chosen, and its reset returns there', async () => {
  const { track } = await createTrack()
  const params = () =>
    resolveSubMenu(
      track
        .trackMenuItems()
        .find(i => 'label' in i && i.label === 'GC parameters') as SubMenuItem,
    )
  const labels = () => params().map(i => ('label' in i ? i.label : i.type))
  expect(track.step).toBe('auto')
  expect(labels()).not.toContain('Step size')
  const follows = params().find(
    i => 'label' in i && i.label === 'Step follows zoom',
  ) as CheckboxMenuItem
  expect(follows.checked).toBe(true)
  follows.onClick(track)
  expect(track.step).toBe(track.window)
  expect(labels()).toContain('Step size')
  track.setStep('auto')
  expect(labels()).not.toContain('Step size')
})

test('the track menu carries the GC parameters beside the plot', async () => {
  const { track } = await createTrack()
  const items = track.trackMenuItems()
  expect(items.map(i => ('label' in i ? i.label : undefined))).toEqual(
    expect.arrayContaining(['GC parameters', 'Y axis...']),
  )
  expect(items.some(i => 'label' in i && i.label === 'GC skew')).toBe(false)
})

test('GC parameters opens on a content / skew radio pair that sets the op', async () => {
  const { track } = await createTrack()
  const params = track
    .trackMenuItems()
    .find(i => 'label' in i && i.label === 'GC parameters')!
  const [content, skew] = resolveSubMenu(params as SubMenuItem)
  expect([content, skew]).toMatchObject([
    { type: 'radio', label: 'GC content', checked: true },
    { type: 'radio', label: 'GC skew', checked: false },
  ])
  ;(skew as RadioMenuItem).onClick(track)
  expect(track.op).toBe('skew')
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
  expect([display.resolvedDomainMin, display.resolvedDomainMax]).toEqual([0, 1])
  display.setDomainMax(0.75)
  expect([display.resolvedDomainMin, display.resolvedDomainMax]).toEqual([
    0, 0.75,
  ])
  display.setRpcData(0, { sources: [] }, region)
  display.setDomainMax(undefined)
  expect([display.resolvedDomainMin, display.resolvedDomainMax]).toEqual([
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
        windowDelta: 5,
      },
    ],
  })
  expect(readConfObject(conf, ['adapter', 'type'])).toBe('GCContentAdapter')
  expect(readConfObject(conf, ['adapter', 'window'])).toBe(10)
  expect(readConfObject(conf, ['adapter', 'step'])).toBe(5)
  expect(readConfObject(conf, ['adapter', 'sequenceAdapter'])).toMatchObject({
    type: 'IndexedFastaAdapter',
  })
  const [display] = conf.displays
  expect(display.type).toBe('LinearWiggleDisplay')
  expect(readConfObject(display, ['encoding', 'y', 'field'])).toBe('score')
})

test('displayDefaults GC settings land on the adapter too', () => {
  expect(
    liftGCSettings({
      type: 'GCContentTrack',
      adapter: { type: 'GCContentAdapter' },
      displayDefaults: { windowDelta: 25, windowSize: 50, height: 80 },
    }),
  ).toMatchObject({
    adapter: { type: 'GCContentAdapter', windowDelta: 25, windowSize: 50 },
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
