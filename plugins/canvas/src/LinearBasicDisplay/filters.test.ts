import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Boots a real LinearBasicDisplay (canvas) inside an LGV so getConf-backed
// reads resolve. jexlFilters on the display config is what activeFilters() reads
// as the config default.
//
// NB: the view's display snapshot MUST set `configuration: '<displayId>'` (a
// string reference), exactly like production showTrackGeneric does
// (util/tracks.ts). Omitting it makes the configuration union fall to its inline
// schemaType branch and silently build a *default* config — so every slot reads
// its default and the track's real config (jexlFilters etc.) is never seen.
function createDisplay(jexlFilters: string[] = []) {
  const pluginManager = new PluginManager()
  const configSchema = configSchemaFactory(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'FeatureTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'FeatureTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'FeatureTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearBasicDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'FeatureTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      displays: [{ type: 'LinearBasicDisplay', displayId: 'd1', jexlFilters }],
    },
    { pluginManager },
  )

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: jest.fn() },
      assemblyManager: { get: () => undefined },
    }))
    .views(() => ({
      get tracksById() {
        return { test_track: trackConfig }
      },
      get themeOptions() {
        return undefined
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
          type: 'FeatureTrack',
          configuration: 'test_track',
          displays: [{ type: 'LinearBasicDisplay', configuration: 'd1' }],
        },
      ],
    }),
  )
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  return view.tracks[0]!.displays[0]!
}

describe('canvas display runtime filters', () => {
  it('activeFilters() prefixes the config jexlFilters slot when no override is set', () => {
    const display = createDisplay([`get(feature,'type')=='gene'`])
    expect(display.activeFilters()).toEqual([`jexl:get(feature,'type')=='gene'`])
  })

  it('the runtime override replaces (shadows) the config jexlFilters slot', () => {
    const display = createDisplay([`get(feature,'type')=='gene'`])
    display.setJexlFilters([`jexl:get(feature,'score')>5`])
    expect(display.activeFilters()).toEqual([`jexl:get(feature,'score')>5`])
  })

  it('an empty override means "no filters" (distinct from unset)', () => {
    const display = createDisplay([`get(feature,'type')=='gene'`])
    display.setJexlFilters([])
    expect(display.activeFilters()).toEqual([])
  })

  it('clearing the override (undefined) falls back to the config slot', () => {
    const display = createDisplay([`get(feature,'type')=='gene'`])
    display.setJexlFilters([`jexl:get(feature,'score')>5`])
    display.setJexlFilters(undefined)
    expect(display.activeFilters()).toEqual([`jexl:get(feature,'type')=='gene'`])
  })

  it('rpcProps().displayConfig.jexlFilters carries the effective filters', () => {
    const display = createDisplay([`get(feature,'type')=='gene'`])
    expect(display.rpcProps().displayConfig.jexlFilters).toEqual([
      `jexl:get(feature,'type')=='gene'`,
    ])
    display.setJexlFilters([`jexl:get(feature,'score')>5`])
    expect(display.rpcProps().displayConfig.jexlFilters).toEqual([
      `jexl:get(feature,'score')>5`,
    ])
  })
})
