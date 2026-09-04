import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { largestRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { getContainingTrack, getContainingView } from '@jbrowse/core/util'
import { adapterConfigKey } from '@jbrowse/core/util/adapterConfigKey'
import { types } from '@jbrowse/mobx-state-tree'

import { autorunOnReadyView } from './displayAutoruns.ts'
import {
  AUTO_FORCE_LOAD_BP,
  evaluateRegionTooLarge,
  nextGateState,
  resolveByteLimit,
} from './regionTooLargeUtils.ts'

import type { RegionHost } from './regionHost.ts'
import type { RegionTooLargeConfigModel } from './regionTooLargeConfigSchemaFields.ts'
import type {
  ByteEstimate,
  GateEvent,
  GateFetchState,
  GateState,
  GateViewport,
} from './regionTooLargeUtils.ts'

function applyGateEvent(self: GateState, event: GateEvent) {
  const next = nextGateState(self, event)
  self.byteEstimate = next.byteEstimate
  self.gateMeasuredViewportKey = next.gateMeasuredViewportKey
  self.forceLoadTrack = next.forceLoadTrack
}

/** The whole of what `RegionTooLargeMixin` needs a composing display to be. */
export interface RegionTooLargeHost {
  configuration: RegionTooLargeConfigModel
  /** `FetchMixin`'s: the retry every composing display carries, which `forceLoad` runs after the approval */
  reload: () => void
  /**
   * `FetchMixin`'s serialized `rpcProps()`, which both foundations compose
   * beside this mixin. A term of the measurement, never of the budget — see
   * `gateViewport`.
   */
  rpcPropsCacheKey: string
}

function host(self: object) {
  return self as RegionTooLargeHost
}

/**
 * The region-too-large gate: a display opts in by overriding `gateEnabled` and
 * passing `byteLimit: self.resolvedByteLimit()` to its fetch RPC. The RPC
 * measures the index before it downloads and answers a refusal when a region
 * is over budget; the fetch runners commit what it measured, and
 * `regionTooLarge` is derived from that last measurement. While the banner is
 * up the fetch runs once per settled viewport and settings, which is the
 * re-measure.
 * Composed by `MultiRegionDisplayMixin` and `GlobalFetchMixin`. The rules and
 * the numbers behind them: agent-docs/reference/REGION_TOO_LARGE.md.
 *
 * #stateModel RegionTooLargeMixin
 * #category display
 */
export default function RegionTooLargeMixin() {
  return types
    .model('RegionTooLargeMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * The force-load button's track-wide approval. Volatile so it never
       * reaches a saved session; the `forceLoad` config slot is the durable form.
       */
      forceLoadTrack: false,
      /**
       * #volatile
       * The last byte measurement: bytes, the span they were taken at, and
       * whether zooming has been shown not to shrink them. Survives
       * `clearAllRpcData`; dropped on chromosome navigation and on a tier swap.
       */
      byteEstimate: undefined as ByteEstimate | undefined,
      /**
       * #volatile
       * The `gateViewport` key the gate last asked the adapter about, on either
       * axis — the viewport AND the settings it asked under. Separate from
       * `byteEstimate` because a density refusal measures no bytes.
       */
      gateMeasuredViewportKey: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * The opt-in. Overridden with a literal `true` by gated displays, and
       * `check-gated-adapter-budgets` insists on a literal: this mixin returns
       * early on it in an autorun and in `commitFetchBytes`.
       */
      get gateEnabled(): boolean {
        return false
      },
      /**
       * #getter
       * The adapter config the gate measures — the one at `byteGateAdapterPath`.
       * Overridable for a display whose adapter config is synthesized rather
       * than read off the track.
       */
      get byteGateAdapterConfig(): Record<string, unknown> {
        return getConf(getContainingTrack(self), this.byteGateAdapterPath)
      },
      /**
       * #getter
       * The display's `fetchSizeLimit` slot, from
       * `regionTooLargeConfigSchemaFields`. `number | undefined`, because
       * `getConf` answers `undefined` for a slot a composing display's schema
       * never declared and typing it `number` hid the whole failure —
       * `resolveByteLimit` falls back closed, and says why.
       */
      get configuredFetchSizeLimit(): number | undefined {
        return getConf(host(self), 'fetchSizeLimit')
      },
      /**
       * #getter
       * The density axis's verdict, and the whole of that axis's opt-in:
       * `CanvasFeatureGateMixin` overrides it beside the measurement that
       * fills it, and a byte-only display leaves it false.
       */
      get densityTooLarge(): boolean {
        return false
      },
      /**
       * #getter
       * Where on the track config the measured adapter sits. A tiered display
       * overrides this one hook (MAF: `['adapter', 'summaryAdapter']` while
       * `showSummary`), and both the measurement and the budget follow it.
       */
      get byteGateAdapterPath(): string[] {
        return ['adapter']
      },
      /**
       * #getter
       * The measured adapter's own `fetchSizeLimit` slot, read off the live
       * track config rather than the `adapterConfig` snapshot, which omits
       * slots at their default.
       */
      get adapterFetchSizeLimit(): number | undefined {
        return readConfObject(getContainingTrack(self).configuration, [
          ...this.byteGateAdapterPath,
          'fetchSizeLimit',
        ])
      },
      /**
       * #getter
       * The declarative `forceLoad` slot.
       */
      get configForceLoad(): boolean {
        return getConf(host(self), 'forceLoad')
      },
      /**
       * #getter
       * What a measurement taken now would be about: the span on screen, and a
       * key for the stretch of genome it covers **and the settings it would be
       * taken under**. Undefined until the view is measured, and the mixin's
       * only read of the view. Captured before the fetch's round trip, never at
       * commit, so the stamp names the settings the worker actually counted
       * under.
       *
       * The settings term is `rpcPropsCacheKey`, the axis both families already
       * invalidate data on. It belongs in the measurement because the worker's
       * density probe counts ADMITTED features (`densityGate`'s `admit`), so a
       * filter admitting almost nothing is a different measurement of the same
       * viewport — and while staleness was viewport-only, the main thread never
       * went back to ask. The byte axis is an index read no `rpcProps` field can
       * move; the rule is one rule rather than one per axis.
       */
      get gateViewport(): GateViewport | undefined {
        const view = getContainingView(self) as RegionHost
        if (!view.initialized) {
          return undefined
        }
        const regions = view.visibleRegions
          .map(
            r =>
              `${r.displayedRegionIndex}:${r.refName}:${Math.floor(r.start)}-${Math.ceil(r.end)}`,
          )
          .join(',')
        return {
          spanBp: view.visibleBp,
          key: `${regions}|${host(self).rpcPropsCacheKey}`,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Which tier the estimate is about, as a comparable string.
       */
      get byteGateAdapterKey(): string {
        return adapterConfigKey(self.byteGateAdapterConfig)
      },
      /**
       * #getter
       * Whether the span on screen is at or above `AUTO_FORCE_LOAD_BP`, the one
       * comparison against that constant. False on an unmeasured view.
       */
      get aboveForceLoadFloor(): boolean {
        const spanBp = self.gateViewport?.spanBp
        return spanBp !== undefined && spanBp >= AUTO_FORCE_LOAD_BP
      },
      /**
       * #getter
       * Nothing may gate on either axis: the `forceLoad` slot or the button.
       */
      get gateExempt() {
        return self.configForceLoad || self.forceLoadTrack
      },
      /**
       * #getter
       * The stored estimate's bytes; undefined when nothing has been measured.
       */
      get estimatedFetchBytes() {
        return self.byteEstimate?.bytes
      },
      /**
       * #getter
       * Whether the last measurement still describes what a fetch issued now
       * would ask: the viewport on screen, under the settings on screen. True
       * before any measurement. The triple's third term, the adapter tier, is
       * not here — a tier swap drops the measurement outright
       * (`ClearByteEstimateOnNavOrTierSwap`) rather than marking it stale.
       */
      get gateMeasurementStale(): boolean {
        return self.gateMeasuredViewportKey !== self.gateViewport?.key
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The byte budget: the adapter's limit, else the display's, doubled below
       * `AUTO_FORCE_LOAD_BP`. Read only through `resolvedByteLimit()`.
       */
      get gateByteLimit() {
        return resolveByteLimit({
          adapterFetchSizeLimit: self.adapterFetchSizeLimit,
          configFetchSizeLimit: self.configuredFetchSizeLimit,
          belowForceLoadFloor: !self.aboveForceLoadFloor,
        })
      },
      /**
       * #getter
       * Whether the gate may act right now, on any axis: opted in, not exempt,
       * view measured. The view is read last, so an ungated display never
       * touches it.
       */
      get gateActive(): boolean {
        return (
          self.gateEnabled &&
          !self.gateExempt &&
          self.gateViewport !== undefined
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the density axis may act: `gateActive`, and the span is above
       * the floor — the one axis the floor applies to. Whether it has anything
       * to say is `densityTooLarge`.
       */
      get densityGateActive(): boolean {
        return self.gateActive && self.aboveForceLoadFloor
      },
      /**
       * #method
       * The budget the worker enforces and the banner compares against — the
       * one spelling of that pair. Undefined when the gate may not act.
       */
      resolvedByteLimit(): number | undefined {
        return self.gateActive ? self.gateByteLimit : undefined
      },
      /**
       * #method
       * The gate as it stands for a fetch about to be issued. Calling it is the
       * capture, which is why it is a method.
       */
      gateFetchState(): GateFetchState {
        return {
          viewport: self.gateViewport,
          gated: self.gateActive,
          tierKey: self.gateEnabled ? self.byteGateAdapterKey : undefined,
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The verdict and its banner text, from the stored estimate against
       * `resolvedByteLimit()` and the density axis when it may act.
       */
      get tooLargeStatus() {
        return evaluateRegionTooLarge({
          estimatedFetchBytes: self.estimatedFetchBytes,
          byteLimit: self.resolvedByteLimit(),
          densityTooLarge: self.densityGateActive && self.densityTooLarge,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get regionTooLarge() {
        return self.tooLargeStatus.tooLarge
      },

      /**
       * #getter
       * Banner text for the axis that tripped; empty when not too large.
       */
      get regionTooLargeReason() {
        return self.tooLargeStatus.reason
      },

      /**
       * #getter
       * Whether "zoom in to see features" is honest advice. Density always
       * releases on zoom; bytes only if the last zoom-in moved the estimate.
       */
      get zoomCanReleaseGate(): boolean {
        return (
          self.tooLargeStatus.axis !== 'bytes' ||
          !self.byteEstimate?.zoomIneffective
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The skip both fetch skeletons apply: the banner is up and its
       * measurement already describes the viewport on screen.
       */
      get gateSkipsMeasuredViewport(): boolean {
        return self.regionTooLarge && !self.gateMeasurementStale
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Drops the estimate and the viewport stamp. `forceLoadTrack` survives:
       * it is a track-wide approval.
       */
      clearByteEstimate() {
        applyGateEvent(self, { kind: 'invalidated' })
      },

      /**
       * #action
       */
      setForceLoadTrack(flag: boolean) {
        applyGateEvent(self, { kind: 'forceLoad', approved: flag })
      },
    }))
    .actions(self => ({
      /**
       * #action
       * The byte axis of a finished fetch, called by the fetch runners with the
       * `gateFetchState()` they captured at issue. Commits the per-region max;
       * an empty batch, or an ungated display, commits nothing.
       */
      commitFetchBytes(
        perRegionBytes: (number | undefined)[],
        issued: GateFetchState,
        partial: boolean = false,
      ) {
        if (self.gateEnabled && perRegionBytes.length > 0) {
          applyGateEvent(self, {
            kind: 'measurement',
            issued,
            currentTierKey: self.byteGateAdapterKey,
            bytes: largestRegionBytes(perRegionBytes),
            partial,
          })
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * The banner's button: exempt the track on both axes and refetch.
       */
      forceLoad() {
        self.setForceLoadTrack(true)
        host(self).reload()
      },
    }))
    .actions(self => ({
      afterAttach() {
        autorunOnReadyView(
          self,
          view => {
            if (!self.gateEnabled) {
              return
            }
            void view.displayedRegions
            void self.byteGateAdapterKey
            self.clearByteEstimate()
          },
          { name: 'ClearByteEstimateOnNavOrTierSwap' },
        )
      },
    }))
}
