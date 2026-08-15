import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import {
  displayTestSessionModel,
  testAssembly,
  testAssemblyManager,
} from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import FeatureComponent from './components/FeatureComponent.tsx'
import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type {
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// Shared display-instantiation harness: builds a PluginManager with a
// FeatureTrack + LinearBasicDisplay and a minimal session/assemblyManager so a
// real display model can be created and driven in unit tests. createDisplay
// accepts extra display-snapshot props so tests can seed persistent state (e.g.
// soloFeatureIds) declaratively, exactly as the app does via addView.
export function createTestEnvironment(opts?: {
  // when set, the track gets a TestAdapter whose fetchSizeLimit slot carries
  // this value, exercising the adapter-limit path in the byte gate
  adapterFetchSizeLimit?: number
}) {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md).
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

  const configSchema = configSchemaFactory(pluginManager)

  // Config-only adapter with a fetchSizeLimit slot; the RPC is mocked so the
  // adapter class is never instantiated — the display only reads its config.
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'TestAdapter',
        configSchema: ConfigurationSchema('TestAdapter', {
          fetchSizeLimit: { type: 'number', defaultValue: 5_000_000 },
        }),
        getAdapterClass: () => {
          throw new Error('TestAdapter is config-only in tests')
        },
      }),
  )

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

  const mockRpcCall = jest.fn()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'FeatureTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      ...(opts?.adapterFetchSizeLimit === undefined
        ? {}
        : {
            adapter: {
              type: 'TestAdapter',
              fetchSizeLimit: opts.adapterFetchSizeLimit,
            },
          }),
    },
    { pluginManager },
  )

  const Session = displayTestSessionModel({
    viewModel: LinearGenomeModel,
    rpcManager: { call: mockRpcCall },
    assemblyManager: testAssemblyManager(testAssembly()),
    getTrackById: (id: string) =>
      id === 'test_track' ? trackConfig : undefined,
  })

  function createDisplay(
    displaySnapshot?: Record<string, unknown>,
    // `unmeasuredView` leaves the view without a width, i.e. before
    // `view.initialized` — the window where every view-derived getter throws by
    // design. Only a test driving that window wants it.
    opts?: { unmeasuredView?: boolean },
  ) {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'FeatureTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearBasicDisplay', ...displaySnapshot }],
          },
        ],
      }),
    )
    if (!opts?.unmeasuredView) {
      view.setWidth(800)
      view.setDisplayedRegions([
        { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
      ])
    }

    const track = view.tracks[0]!
    const display = track.displays[0]!
    return { session, view, track, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}

export type TestDisplay = ReturnType<
  ReturnType<typeof createTestEnvironment>['createDisplay']
>['display']

// The feature menu is a tree — the highlight scopes, the show/hide family and
// the copy entries each earn a submenu — but a test names the ROW it wants, not
// the path to it. So flatten before matching, and let a row that moves into or
// out of a submenu stay one test.
function flattenMenuItems(items: MenuItem[]): MenuItem[] {
  return items.flatMap(m =>
    'subMenu' in m ? flattenMenuItems(m.subMenu) : [m],
  )
}

// Every label the open context menu offers, submenus included.
export function contextMenuLabels(display: TestDisplay) {
  return flattenMenuItems(display.contextMenuItems()).map(m =>
    'label' in m ? m.label : '',
  )
}

// Click the context-menu row with this label. Throws — rather than silently
// doing nothing — when no such row exists, so a renamed or dropped item fails
// where the test names it instead of one assertion later.
export function clickContextMenuItem(display: TestDisplay, label: string) {
  const item = flattenMenuItems(display.contextMenuItems()).find(
    m => 'label' in m && m.label === label,
  )
  if (item && 'onClick' in item) {
    item.onClick()
  } else {
    throw new Error(`no clickable menu item labeled "${label}"`)
  }
}

// Right-click on `item`, resolving `subfeature` when the click landed on one —
// what FeatureComponent's handleContextMenu does, minus the hit test. The click
// position is fixed since only the Menu component reads it.
export function rightClick(
  display: TestDisplay,
  item: FlatbushItem,
  subfeature?: SubfeatureInfo,
  // what the hit resolved beyond the feature itself: only a click on a base at
  // base zoom carries these
  resolved?: { hgvsLabel?: string; tooltipText?: string },
) {
  display.openContextMenu({
    item,
    subfeature,
    ...resolved,
    displayedRegionIndex: 0,
    clientX: 0,
    clientY: 0,
  })
}
