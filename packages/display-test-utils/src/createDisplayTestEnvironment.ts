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

import { displayTestSessionModel } from './displayTestSessionModel.ts'
import { testAssembly, testAssemblyManager } from './testAssembly.ts'

import type Plugin from '@jbrowse/core/Plugin'
import type {
  AnyConfigurationSchemaType,
  ConfigurationSchemaDefinition,
} from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util'
import type { IAnyModelType } from '@jbrowse/mobx-state-tree'

// `'config' in adapter`, not `??`: the two states a caller needs are "give me
// the obvious one" and "give me none", and only key presence tells them apart.
function adapterTrackConfig(adapter: TestAdapterSpec | undefined) {
  if (!adapter) {
    return {}
  }
  const config = 'config' in adapter ? adapter.config : { type: adapter.name }
  return config ? { adapter: config } : {}
}

/** A stand-in adapter the display's config can point at. */
export interface TestAdapterSpec {
  name: string
  /** Config slots the test needs to set. Nothing is read; the class is empty. */
  slots?: ConfigurationSchemaDefinition
  /**
   * What the track config's `adapter` becomes. Omitted, it is `{ type: name }`.
   * Present-but-`undefined` puts **no** adapter on the track while still
   * registering the type — which is how a test asserts what a display falls back
   * to when the adapter declares nothing (canvas's `adapterFetchSizeLimit`).
   */
  config?: Record<string, unknown>
  /** e.g. `['hasResolution']`, which wiggle's resolution menu gates on. */
  capabilities?: string[]
  /**
   * Refuse to resolve an adapter class. For a display whose RPC is mocked and
   * which only ever reads the adapter's *config*, this turns "something
   * instantiated it after all" from a silent success into a thrown error.
   */
  configOnly?: boolean
}

export interface DisplayTestEnvironmentOptions {
  /**
   * Plugins the `PluginManager` is constructed with. The **caller** supplies
   * these, and `viewModel` below, because this package sits under `plugins/` in
   * the workspace layering and cannot import one — see ARCHITECTURE.md
   * "Workspace tiers". In practice every caller passes
   * `[new LinearGenomeViewPlugin()]`, which is what a display config schema
   * reaching `pluginManager.getPlugin('LinearGenomeViewPlugin')` needs.
   */
  plugins?: Plugin[]
  /** Track type to register and put the display on, e.g. `'VariantTrack'`. */
  trackType: string
  /** Registered only when given; a display with no adapter needs none. */
  adapter?: TestAdapterSpec
  displayName: string
  configSchema: (pluginManager: PluginManager) => AnyConfigurationSchemaType
  stateModel: (
    pluginManager: PluginManager,
    configSchema: AnyConfigurationSchemaType,
  ) => IAnyModelType
  /** `linearGenomeViewStateModelFactory(pluginManager)`, from the caller. */
  viewModel: (pluginManager: PluginManager) => IAnyModelType
  /** Extra keys on the track config, merged over the defaults. */
  trackConfig?: Record<string, unknown>
  /**
   * Display **config** slots, written into the track config's own `displays`
   * entry and referenced by id — not onto the display's session snapshot, where
   * a slot name is dropped in silence (ARCHITECTURE.md, "where a display's state
   * lives"). This is the only way to reach a slot with no setter.
   */
  displayConfig?: Record<string, unknown>
  /** Assembly length, for the single-`ctgA` default. Defaults to 50,000. */
  assemblyEnd?: number
  /** Displayed-region length, for that same default. Defaults to `assemblyEnd`. */
  viewRegionEnd?: number
  /**
   * The whole region list, when one contig is not enough — a display whose
   * behavior is about what happens ACROSS regions (Manhattan's LD auto-index has
   * to survive a partially-arrived batch) needs two. Replaces both scalars.
   */
  regions?: Region[]
  /**
   * The assembly's regions, when they differ from what the view displays — a
   * gate test loads one contig out of an assembly that declares two, so the
   * navigation it exercises has somewhere to go.
   */
  assemblyRegions?: Region[]
  /** Extra view setup, after the width and displayed regions are set. */
  onViewReady?: (view: any) => void
  /**
   * The body `mockRpcCall` is a `jest.fn()` over. Bare by default, which
   * resolves `undefined` for every method; a display gated on a byte estimate
   * needs one that answers `CoreGetRegionByteEstimate`, or its fetch never
   * commits and the suite reads as a broken display rather than a stub gap.
   */
  rpcCall?: (sessionId: string, method: string, args: unknown) => unknown
}

/**
 * A headless display harness: one track type carrying one display type, inside
 * a real `LinearGenomeView`, with `rpcManager.call` mocked.
 *
 * Nine plugins had written this out — 1,300 lines whose only real differences
 * were the two names, the two factories, and whether an adapter was registered.
 * Half of them annotated `displays[0]`, which is what turns a getter the model
 * does not have into a compile error rather than a silent `any`; the other half
 * left it inferred, so those suites were asserting against `any`.
 *
 * A real display inside a real view, rather than `stateModel.create()`, is the
 * whole point: `afterAttach` runs, the containing view resolves, and the derived
 * getters most of these tests are about read both.
 */
export function createDisplayTestEnvironment<T>({
  plugins = [],
  trackType,
  adapter,
  displayName,
  configSchema,
  stateModel,
  viewModel,
  trackConfig: extraTrackConfig,
  displayConfig,
  assemblyEnd = 50_000,
  viewRegionEnd = assemblyEnd,
  regions,
  assemblyRegions,
  onViewReady,
  rpcCall,
}: DisplayTestEnvironmentOptions) {
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md), and silencing it would swallow every violation
  // report the jest gate exists to catch.
  console.warn = jest.fn()
  const pluginManager = new PluginManager(plugins)
  const DISPLAY_ID = `test_track-${displayName}`

  if (adapter) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: adapter.name,
          configSchema: ConfigurationSchema(adapter.name, adapter.slots ?? {}, {
            explicitlyTyped: true,
          }),
          adapterCapabilities: adapter.capabilities,
          getAdapterClass: adapter.configOnly
            ? () => {
                throw new Error(`${adapter.name} is config-only in tests`)
              }
            : () => Promise.resolve(class extends BaseAdapter {}),
        }),
    )
  }

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      trackType,
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: trackType,
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        trackType,
        trackConfigSchema,
      ),
    })
  })

  const displayConfigSchema = configSchema(pluginManager)
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: displayName,
        configSchema: displayConfigSchema,
        stateModel: stateModel(pluginManager, displayConfigSchema),
        trackType,
        viewType: 'LinearGenomeView',
        ReactComponent: () => null,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

  // typed as a bare mock, never narrowed to `rpcCall`'s signature: callers
  // `mockImplementation` it with the arg shapes their own display expects.
  //
  // Never settles when nothing stubs it, rather than resolving `undefined`. A
  // fetch RPC answers a payload or a refusal, never nothing, so `undefined` is a
  // shape no display is written for — and every one of them stored it as region
  // data, where the getters reading it threw inside an autorun MobX swallows.
  //
  // Pending rather than rejected because the stub arrives AFTER `createDisplay`
  // in most suites, and the fetch that runs in between must not decide
  // anything: an unanswered call leaves the display exactly as it was, which is
  // what those tests already assume. Nothing awaits this fetch — a suite that
  // wants one stubs the method.
  const mockRpcCall: jest.Mock = jest.fn()
  if (rpcCall) {
    mockRpcCall.mockImplementation(rpcCall)
  } else {
    mockRpcCall.mockImplementation(() => new Promise(() => {}))
  }
  const ViewModel = viewModel(pluginManager)
  const trackConfig = pluginManager.pluggableConfigSchemaType('track').create(
    {
      type: trackType,
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      ...adapterTrackConfig(adapter),
      ...(displayConfig
        ? {
            displays: [
              { type: displayName, displayId: DISPLAY_ID, ...displayConfig },
            ],
          }
        : {}),
      ...extraTrackConfig,
    },
    { pluginManager },
  )

  const Session = displayTestSessionModel({
    viewModel: ViewModel,
    rpcManager: { call: mockRpcCall },
    assemblyManager: testAssemblyManager(
      testAssembly({
        regions: assemblyRegions ??
          regions ?? [
            {
              refName: 'ctgA',
              start: 0,
              end: assemblyEnd,
              assemblyName: 'volvox',
            },
          ],
      }),
    ),
    getTrackById: (id: string) =>
      id === 'test_track' ? trackConfig : undefined,
  })

  /**
   * @param opts.displayedRegions - what the view shows, when it differs from
   *   the assembly (a gate test loading one contig of two)
   * @param opts.displaySnapshot - display **instance** keys, i.e. MST
   *   properties. Config slots go in `displayConfig` above; a slot name here is
   *   dropped in silence.
   */
  function createDisplay({
    displayedRegions,
    displaySnapshot,
    skipWidth = false,
    regionsInSnapshot = false,
  }: {
    displayedRegions?: Region[]
    displaySnapshot?: Record<string, unknown>
    /**
     * Leave the view unmeasured (`initialized` false), which is the state every
     * gate getter has to survive without throwing on `view.width`.
     * `setDisplayedRegions` zooms, which reads the width, so it waits too.
     */
    skipWidth?: boolean
    /**
     * Put the regions in the view's SNAPSHOT rather than calling
     * `setDisplayedRegions`, which is what a restored session does — and the
     * only way to reach a measured view with no coarse blocks, since every
     * placement action settles them now (`settleCoarseBlocks`). The 500ms
     * `LGVCoarseDynamicBlocks` autorun is what ends this state in production, so
     * a test wanting it must not advance timers past that.
     */
    regionsInSnapshot?: boolean
  } = {}) {
    const viewRegions = displayedRegions ??
      regions ?? [
        {
          assemblyName: 'volvox',
          start: 0,
          end: viewRegionEnd,
          refName: 'ctgA',
        },
      ]
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      ViewModel.create({
        type: 'LinearGenomeView',
        ...(regionsInSnapshot ? { displayedRegions: viewRegions } : {}),
        tracks: [
          {
            type: trackType,
            configuration: 'test_track',
            // `configuration`, so the display resolves the config node the
            // track declares — the one carrying `displayConfig`'s slots
            displays: [
              {
                type: displayName,
                ...(displayConfig ? { configuration: DISPLAY_ID } : {}),
                ...displaySnapshot,
              },
            ],
          },
        ],
      }),
    )
    if (!skipWidth) {
      view.setWidth(800)
      if (!regionsInSnapshot) {
        view.setDisplayedRegions(viewRegions)
      }
      onViewReady?.(view)
    }
    // `displays[0]` is untyped; annotating it makes a getter that doesn't exist
    // on the model a typecheck error rather than a silent any
    const track = view.tracks[0]!
    const display: T = track.displays[0]
    return { session, view, track, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall, pluginManager, trackConfig }
}
