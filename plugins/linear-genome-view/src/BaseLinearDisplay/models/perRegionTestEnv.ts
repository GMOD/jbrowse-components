import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { types } from '@jbrowse/mobx-state-tree'

import { stateModelFactory as linearGenomeViewStateModelFactory } from '../../LinearGenomeView/index.ts'
import MultiRegionDisplayMixin from './MultiRegionDisplayMixin.ts'
import TrackHeightMixin from './TrackHeightMixin.tsx'
import baseLinearDisplayConfigSchema from './configSchema.ts'
import { fetchEachRegion } from './fetchEachRegion.ts'

import type { IndexedRegion } from './planRegionFetch.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

const DISPLAY_NAME = 'PerRegionTestDisplay'

// A fresh schema per environment, and the state model is handed the very
// instance the harness registered — the pattern every other testEnv follows. A
// module-level singleton shared across PluginManagers leaves the display's
// `configuration` reference unresolvable, and the gate then reads every slot as
// undefined rather than erroring.
function makeConfigSchema() {
  return ConfigurationSchema(
    DISPLAY_NAME,
    {},
    { baseConfiguration: baseLinearDisplayConfigSchema, explicitlyTyped: true },
  )
}

/**
 * The knobs a test needs on the display's fetch, held in a closure rather than
 * as volatiles. `regionHasData` must stay a **view** — as an action MobX runs it
 * untracked and the autorun keeps a stale answer (see the hook block in
 * `MultiRegionDisplayMixin`) — and a view may not write, so its call counter
 * cannot live in the tree.
 */
export interface PerRegionTestControl {
  /** how many times the fetch autorun has asked `regionHasData` */
  cacheValidCalls: number
  /**
   * How many further `regionHasData` calls answer false, decremented each time.
   * Bounded on purpose: a permanently-invalid cache refetches forever, which is
   * correct behavior and an unfalsifiable test.
   */
  staleAnswers: number
  /** the next fetch rejects, the way a failed RPC does */
  failNextFetch: boolean
  /** hold each fetch open this long, so a test can act while one is in flight */
  fetchDelayMs: number
  /** what `CoreGetRegionByteEstimate` answers, and how often it was asked */
  estimateBytes: number
  estimateCalls: number
  /** the display's own density verdict, canvas's second too-large axis */
  densityTooLarge: boolean
}

/**
 * The smallest possible display on `MultiRegionDisplayMixin`: it fetches, it
 * records what it was asked to fetch, and it does nothing else. Nine real
 * displays compose this foundation, and every one of them adds a plugin's worth
 * of behavior on top — so a test that boots one is testing that plugin as much
 * as the foundation, which is how the foundation's own autoruns came to be
 * pinned only by canvas's suite.
 */
/** Which of the gate's opt-in hooks this display overrides. */
export interface GateOptIns {
  measuresBytesPreFlight?: boolean
  measuresBytesInFetch?: boolean
  densityGateEnabled?: boolean
}

function makeStateModel(
  control: PerRegionTestControl,
  gate: GateOptIns,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      DISPLAY_NAME,
      BaseDisplay,
      // every real per-region display composes this, and the hover-clear
      // reaction the foundation installs reads its `scrollTop`
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      types.model({
        type: types.literal(DISPLAY_NAME),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /** every `fetchNeeded` call, as the region list it was handed */
      fetchLog: [] as IndexedRegion[][],
      loadedData: new Map<number, string>(),
      /**
       * What `regionFetchKey` answers. A volatile, not a `control` knob, and
       * that is the point: a real display's key reads view state, so the
       * autorun re-runs when it moves. A plain closure value would be memoized
       * by the computed and never invalidate.
       */
      fetchKey: '',
    }))
    .views(self => ({
      get measuresBytesPreFlight() {
        return gate.measuresBytesPreFlight ?? false
      },
      get measuresBytesInFetch() {
        return gate.measuresBytesInFetch ?? false
      },
      get densityGateEnabled() {
        return gate.densityGateEnabled ?? false
      },
      get densityTooLarge() {
        return control.densityTooLarge
      },
      get regionFetchKey() {
        return self.fetchKey
      },
      regionHasData(_displayedRegionIndex: number) {
        control.cacheValidCalls += 1
        if (control.staleAnswers > 0) {
          control.staleAnswers -= 1
          return false
        }
        return true
      },
    }))
    .actions(self => ({
      setFetchKey(key: string) {
        self.fetchKey = key
      },
      setLoaded(displayedRegionIndex: number, value: string) {
        self.loadedData.set(displayedRegionIndex, value)
      },
      clearDisplaySpecificData() {
        self.loadedData.clear()
      },
    }))
    .actions(self => ({
      fetchNeeded(needed: IndexedRegion[]) {
        self.fetchLog.push(needed)
        return fetchEachRegion(self, needed, {
          call: async () => {
            if (control.fetchDelayMs > 0) {
              await new Promise(r => setTimeout(r, control.fetchDelayMs))
            }
            if (control.failNextFetch) {
              control.failNextFetch = false
              throw new Error('rpc failed')
            }
            return 'data'
          },
          onResult: (idx, result) => {
            self.setLoaded(idx, result)
          },
        })
      },
    }))
}

export type PerRegionTestDisplay = Instance<ReturnType<typeof makeStateModel>>

/**
 * A real `MultiRegionDisplayMixin` display inside a real `LinearGenomeView`, so
 * `afterAttach` runs and `installPerRegionFetchAutoruns` installs for real.
 */
export function createPerRegionTestEnvironment({
  measuresBytes = false,
  gate,
  estimateBytes = 100,
  ...opts
}: Partial<Parameters<typeof createDisplayTestEnvironment>[0]> & {
  /** shorthand for `gate: { measuresBytesPreFlight: true }` */
  measuresBytes?: boolean
  /** which of the gate's opt-in hooks the display overrides */
  gate?: GateOptIns
  /**
   * What `CoreGetRegionByteEstimate` answers, set before the display exists.
   * A test that wants the banner has to pass it here rather than raise
   * `control.estimateBytes` afterwards: the fetch autorun is leading-edge, so
   * the first fetch runs the moment the display attaches, and a later write
   * would be measuring a display that had already loaded at the default.
   */
  estimateBytes?: number
} = {}) {
  const control: PerRegionTestControl = {
    cacheValidCalls: 0,
    staleAnswers: 0,
    failNextFetch: false,
    fetchDelayMs: 0,
    estimateBytes,
    estimateCalls: 0,
    densityTooLarge: false,
  }
  const optIns: GateOptIns = gate ?? { measuresBytesPreFlight: measuresBytes }
  const env = createDisplayTestEnvironment<PerRegionTestDisplay>({
    trackType: 'FeatureTrack',
    displayName: DISPLAY_NAME,
    configSchema: makeConfigSchema,
    stateModel: (_pm, schema) => makeStateModel(control, optIns, schema),
    viewModel: linearGenomeViewStateModelFactory,
    assemblyEnd: 100_000,
    // an empty display-config entry is still an entry: without one the harness
    // leaves the display's `configuration` reference unresolved, and every slot
    // the gate reads — `fetchSizeLimit` above all — answers undefined
    displayConfig: {},
    rpcCall: (_sessionId, method) => {
      if (method === 'CoreGetRegionByteEstimate') {
        control.estimateCalls += 1
        return control.estimateBytes
      }
      return []
    },
    ...opts,
  })
  return { ...env, control }
}
