import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema, getConf } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { activeCount } from '@jbrowse/core/ui/filterMenuItems'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import FeatureComponent from './components/FeatureComponent.tsx'
import configSchemaFactory from './configSchema.ts'
import registerLinearBasicDisplay from './index.ts'
import stateModelFactory from './model.ts'

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
  return view.tracks[0]!.displays[0]!
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

  it('refuses a bare expression in the filter slot', () => {
    expect(() => createDisplay([`get(feature,'type')=='gene'`])).toThrow(
      /is not an expression/,
    )
  })

  it('a track that declares no filters opens the dialog empty', () => {
    const display = createDisplay()
    expect(display.configuredFilters()).toEqual([])
  })

  it('setFilter writes the filter slot', () => {
    const display = createDisplay([`jexl:get(feature,'type')=='gene'`])
    display.setFilter([`jexl:get(feature,'score')>5`])
    expect(getConf(display, 'filter')).toEqual([`jexl:get(feature,'score')>5`])
    expect(display.configuredFilters()).toEqual([`jexl:get(feature,'score')>5`])
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

  it('rpcProps().displayConfig.filter carries the filters', () => {
    const display = createDisplay([`jexl:get(feature,'type')=='gene'`])
    expect(display.rpcProps().displayConfig.filter).toEqual([
      `jexl:get(feature,'type')=='gene'`,
    ])
    display.setFilter([`jexl:get(feature,'score')>5`])
    expect(display.rpcProps().displayConfig.filter).toEqual([
      `jexl:get(feature,'score')>5`,
    ])
  })
})

interface MenuEntry {
  label?: string
  onClick?: () => void
  subMenu?: MenuEntry[]
}

function findMenuItem(
  items: MenuEntry[],
  label: string,
): MenuEntry | undefined {
  let found: MenuEntry | undefined
  for (const item of items) {
    if (found === undefined) {
      if (item.label === label) {
        found = item
      } else if (item.subMenu) {
        found = findMenuItem(item.subMenu, label)
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
    )
    expect(item).toBeDefined()
    expect(display.rpcProps().hiddenFeatureIds).toEqual(['gene1', 'gene2'])

    item!.onClick!()
    expect(display.hiddenFeatureIds.length).toBe(0)
    expect(display.rpcProps().hiddenFeatureIds).toBeUndefined()
  })
})
