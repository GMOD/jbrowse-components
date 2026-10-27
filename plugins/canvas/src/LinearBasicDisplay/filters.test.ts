import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { activeCount } from '@jbrowse/core/ui/filterMenuItems'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import FeatureComponent from './components/FeatureComponent.tsx'
import configSchemaFactory from './configSchema.ts'
import registerLinearBasicDisplay from './index.ts'
import stateModelFactory from './model.ts'

import type { LinearBasicDisplayModel } from './model.ts'
import type { ClickableMenuItem, MenuItem } from '@jbrowse/core/ui/menuItems'
import type { Instance } from '@jbrowse/mobx-state-tree'

// The view's display snapshot must set `configuration: '<displayId>'`, or the
// configuration union falls to its inline branch and silently builds a
// default config.
function createDisplay(
  filter?: string[],
  displayConf: Record<string, unknown> = { filter },
) {
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
      ReactComponent: FeatureComponent,
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
      displays: [
        { type: 'LinearBasicDisplay', displayId: 'd1', ...displayConf },
      ],
    },
    { pluginManager },
  )
  const baseTrackSnapshot = getSnapshot(trackConfig)

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
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      baseTrackConfig(id: string) {
        return id === 'test_track' ? baseTrackSnapshot : undefined
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
  return view.tracks[0]!.displays[0]! as LinearBasicDisplayModel
}

describe('canvas display filters', () => {
  it('configuredFilters() is the config filter slot', () => {
    const display = createDisplay([`jexl:get(feature,'type')=='gene'`])
    expect(display.configuredFilters()).toEqual([
      `jexl:get(feature,'type')=='gene'`,
    ])
  })

  it("v4's unprefixed jexlFilters slot loads as a prefixed filter", () => {
    const display = createDisplay(undefined, {
      jexlFilters: [`get(feature,'type')=='gene'`],
    })
    expect(display.configuredFilters()).toEqual([
      `jexl:get(feature,'type')=='gene'`,
    ])
  })

  it("a v4.3 session's jexlFiltersSetting lands in the filter slot, prefixed", () => {
    const pluginManager = new PluginManager()
    registerLinearBasicDisplay(pluginManager)
    pluginManager.createPluggableElements()
    const { retiredState } = pluginManager.getDisplayType('LinearBasicDisplay')
    const display = createDisplay(
      undefined,
      retiredState!.lift({ jexlFiltersSetting: [`get(feature,'score')>5`] }),
    )
    expect(display.configuredFilters()).toEqual([`jexl:get(feature,'score')>5`])
  })

  it("a v4.3 session's trackDisplayMode lands in the displayMode slot", () => {
    const pluginManager = new PluginManager()
    registerLinearBasicDisplay(pluginManager)
    pluginManager.createPluggableElements()
    const { retiredState } = pluginManager.getDisplayType('LinearBasicDisplay')
    expect(retiredState!.lift({ trackDisplayMode: 'compact' })).toEqual({
      displayMode: 'compact',
    })
    expect(retiredState!.lift({ trackDisplayMode: 'collapse' })).toEqual({
      displayMode: 'normal',
    })
  })

  // a bare string is a field that must hold, and a `jexl:` one is computed
  it('reads a bare field name as that field being true', () => {
    const display = createDisplay(['geneLike'])
    expect(display.genesFilter).toBe('only')
    expect(display.configuredFilters()).toEqual([])
  })

  it('a track that declares no filters opens the dialog empty', () => {
    const display = createDisplay()
    expect(display.configuredFilters()).toEqual([])
  })

  it('setFilter writes the expressions and leaves the gene category', () => {
    const display = createDisplay([`jexl:get(feature,'type')=='gene'`])
    display.setGenesFilter('only')
    display.setFilter([`jexl:get(feature,'score')>5`])
    expect(predicatesOf(display.configuration.filter)).toEqual([
      { field: 'geneLike', equal: true },
      { field: `jexl:get(feature,'score')>5`, equal: true },
    ])
    expect(display.configuredFilters()).toEqual([`jexl:get(feature,'score')>5`])
    expect(display.genesFilter).toBe('only')
  })

  it('an empty list clears the filters the track config declares', () => {
    const display = createDisplay([`jexl:get(feature,'type')=='gene'`])
    display.setFilter([])
    expect(display.configuredFilters()).toEqual([])
  })

  it('setFilter(undefined) returns to what the track config declares', () => {
    const display = createDisplay([`jexl:get(feature,'type')=='gene'`])
    display.setFilter([`jexl:get(feature,'score')>5`])
    display.setFilter(undefined)
    expect(display.configuredFilters()).toEqual([
      `jexl:get(feature,'type')=='gene'`,
    ])
  })

  it('does not count filters equal to what the track config declares', () => {
    const display = createDisplay([`jexl:get(feature,'type')=='gene'`])
    expect(activeCount(display.featureNarrowings())).toBe(0)

    display.setFilter(display.configuredFilters())
    expect(activeCount(display.featureNarrowings())).toBe(0)

    const defaulted = createDisplay()
    defaulted.setFilter(defaulted.configuredFilters())
    expect(activeCount(defaulted.featureNarrowings())).toBe(0)
  })

  it('counts filters that differ from what the track config declares, either way', () => {
    const narrower = createDisplay([`jexl:get(feature,'type')=='gene'`])
    narrower.setFilter([`jexl:get(feature,'score')>5`])
    expect(activeCount(narrower.featureNarrowings())).toBe(1)

    const widened = createDisplay([`jexl:get(feature,'type')=='gene'`])
    widened.setFilter([])
    expect(activeCount(widened.featureNarrowings())).toBe(1)

    const empty = createDisplay([])
    empty.setFilter([])
    expect(activeCount(empty.featureNarrowings())).toBe(0)
  })

  it('rpcProps().displayConfig.filter carries the whole filter', () => {
    const display = createDisplay([`jexl:get(feature,'type')=='gene'`])
    expect(display.rpcProps().displayConfig.filter).toEqual([
      { field: `jexl:get(feature,'type')=='gene'`, equal: true },
    ])
    display.setFilter([`jexl:get(feature,'score')>5`])
    display.setGenesFilter('exclude')
    expect(display.rpcProps().displayConfig.filter).toEqual([
      { field: `jexl:get(feature,'score')>5`, equal: true },
      { field: 'geneLike', equal: false },
    ])
  })
})

function findMenuItem(items: MenuItem[], label: string): MenuItem | undefined {
  let found: MenuItem | undefined
  for (const item of items) {
    if (found === undefined) {
      if ('label' in item && item.label === label) {
        found = item
      } else if ('subMenu' in item) {
        found = findMenuItem(resolveSubMenu(item), label)
      }
    }
  }
  return found
}

describe('canvas display hidden-feature track menu', () => {
  it('offers no track-level unhide when nothing is hidden', () => {
    const display = createDisplay()
    expect(
      findMenuItem(display.trackMenuItems(), 'Show 1 hidden feature'),
    ).toBeUndefined()
  })

  it('offers a track-level unhide once features are hidden, and it restores them', () => {
    const display = createDisplay()
    display.hideFeature('gene1')
    display.hideFeature('gene2')

    const item = findMenuItem(
      display.trackMenuItems(),
      'Show 2 hidden features',
    ) as ClickableMenuItem | undefined
    expect(item).toBeDefined()
    expect(display.rpcProps().hiddenFeatureIds).toEqual(['gene1', 'gene2'])

    item!.onClick()
    expect(display.hiddenFeatureIds.length).toBe(0)
    expect(display.rpcProps().hiddenFeatureIds).toBeUndefined()
  })
})
