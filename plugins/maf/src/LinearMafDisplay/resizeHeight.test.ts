import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './stateModel.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness (mirrors derivedRegionTooLarge.test.ts) for exercising the
// real resizeHeight action against a large sample set, where the maxRowsHeight
// canvas cap governs effectiveRowHeight.
function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MafTabixAdapter',
        configSchema: ConfigurationSchema(
          'MafTabixAdapter',
          {},
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )
  const configSchema = configSchemaF(pluginManager)
  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'MafTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'MafTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MafTrack',
        trackConfigSchema,
      ),
    })
  })
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearMafDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'MafTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'MafTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: { type: 'MafTabixAdapter' },
    },
    { pluginManager },
  )
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 10_000_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    configuration: { sequence: undefined },
  }
  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: jest.fn() },
      theme: createJBrowseTheme(),
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        waitForAssembly: () => Promise.resolve(asm),
        isValidRefName: () => true,
      },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      notify() {},
      notifyError() {},
      queueDialog() {},
    }))

  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'MafTrack',
          configuration: 'test_track',
          displays: [{ type: 'LinearMafDisplay' }],
        },
      ],
    }),
  )
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
  ])
  return { display: view.tracks[0]!.displays[0]! }
}

function setup(nSamples: number, rowHeight: number) {
  const { display } = createTestEnvironment()
  display.setSamples({
    samples: Array.from({ length: nSamples }, (_, i) => ({
      id: `s${i}`,
      label: `s${i}`,
    })),
    treeNewick: undefined,
  })
  display.setRowHeight(rowHeight)
  return display
}

// 1000 species at dpr 1: the cap is 8192/1000 = 8.192px per row, so
// effectiveRowHeight (8.192) is well below the raw slot (15).
test('capped: shrink drag moves the rows by the dragged distance', () => {
  const display = setup(1000, 15)
  expect(display.effectiveRowHeight).toBeCloseTo(8.192)
  expect(display.rowHeight).toBe(15)

  const before = display.height
  display.resizeHeight(-100)
  expect(display.height - before).toBeCloseTo(-100)
})

test('capped: grow drag stays clamped at the canvas ceiling', () => {
  const display = setup(1000, 15)
  const before = display.height
  display.resizeHeight(+100)
  // Rows are already at maxRowsHeight; growing past it would blow the canvas
  // backing store, so the height legitimately does not move.
  expect(display.height).toBe(before)
})

// Uncapped: 10 species * 15px = 150px of rows, far under the 8192 ceiling.
test('uncapped: drag still tracks the cursor in both directions', () => {
  const display = setup(10, 15)
  expect(display.effectiveRowHeight).toBe(15)

  const before = display.height
  display.resizeHeight(+100)
  expect(display.height - before).toBeCloseTo(100)

  const mid = display.height
  display.resizeHeight(-60)
  expect(display.height - mid).toBeCloseTo(-60)
})
