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

// Boots a real LinearBasicDisplay (canvas) inside an LGV so the expand/restore
// getters and actions (fitHeight, canExpand, expandToFit, collapseFromExpand)
// run against the actual MST model rather than a re-implemented copy. Mirrors
// the harness in filters.test.ts. No feature data is fetched, so maxY is 0 and
// fitHeight sits at its MIN_FIT_HEIGHT floor (50) — enough to drive the height
// arithmetic and the scroll reset.
function createDisplay() {
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
      displays: [{ type: 'LinearBasicDisplay', displayId: 'd1' }],
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

describe('canvas display expand-to-fit', () => {
  it('fitHeight floors at MIN_FIT_HEIGHT when there is no content', () => {
    const display = createDisplay()
    expect(display.maxY).toBe(0)
    expect(display.fitHeight).toBe(50)
  })

  it('canExpand is true only when fitHeight would grow the track', () => {
    const display = createDisplay()
    // default height 100 > fitHeight 50 -> expanding would shrink, so no offer
    expect(display.height).toBe(100)
    expect(display.canExpand).toBe(false)

    display.setHeight(30)
    expect(display.canExpand).toBe(true)
  })

  it('expandToFit enters persistent grow mode, storing the prior height and resetting scroll', () => {
    const display = createDisplay()
    display.setHeight(30)
    display.setScrollTop(300)

    display.expandToFit()
    // it's the persistent grow mode now, not a one-shot resize
    expect(display.autoHeight).toBe(true)
    expect(display.heightBeforeExpand).toBe(30)
    expect(display.scrollTop).toBe(0)
    // grow fits the content (grownHeight == fitHeight here), so nothing overflows
    expect(display.height).toBe(50)
    expect(display.canExpand).toBe(false)
  })

  it('collapseFromExpand toggles grow off and restores the stored height', () => {
    const display = createDisplay()
    display.setHeight(30)

    display.expandToFit()
    expect(display.autoHeight).toBe(true)

    display.collapseFromExpand()
    expect(display.autoHeight).toBe(false)
    expect(display.height).toBe(30)
    expect(display.heightBeforeExpand).toBeUndefined()
  })

  it('collapseFromExpand is a no-op when nothing was expanded', () => {
    const display = createDisplay()
    display.setHeight(30)
    display.collapseFromExpand()
    expect(display.height).toBe(30)
  })

  it('enabling auto-fit clears a stale expand marker', () => {
    const display = createDisplay()
    display.setHeight(30)
    display.expandToFit()
    expect(display.heightBeforeExpand).toBe(30)

    display.setHeightMode('grow')
    expect(display.heightBeforeExpand).toBeUndefined()
  })

  it('entering a non-fixed mode resets scroll to the top', () => {
    const display = createDisplay()
    display.setScrollTop(300)
    display.setHeightMode('grow')
    expect(display.scrollTop).toBe(0)

    display.setScrollTop(300)
    display.setHeightMode('fit')
    expect(display.scrollTop).toBe(0)

    // fixed leaves scroll alone (the clamp autorun corrects if it overflows)
    display.setScrollTop(300)
    display.setHeightMode('fixed')
    expect(display.scrollTop).toBe(300)
  })

  it('a manual drag-resize turns auto-fit off', () => {
    const display = createDisplay()
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)

    display.resizeHeight(50)
    expect(display.autoHeight).toBe(false)
  })

  it('a manual drag-resize clears a stale expand marker', () => {
    const display = createDisplay()
    display.setHeight(30)
    display.expandToFit()
    expect(display.heightBeforeExpand).toBe(30)

    display.resizeHeight(20)
    expect(display.heightBeforeExpand).toBeUndefined()
  })
})
