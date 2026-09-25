import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { largestRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { getContainingTrack } from '@jbrowse/core/util'
import { isDataCurrent } from '@jbrowse/core/util/isDataCurrent'
import { types } from '@jbrowse/mobx-state-tree'

import { autorunOnReadyView } from './displayAutoruns.ts'
import { containingHost } from './foundationView.ts'
import {
  AUTO_FORCE_LOAD_BP,
  evaluateRegionTooLarge,
  nextGateState,
  resolveByteLimit,
} from './regionTooLargeUtils.ts'

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

/**
 * Where on a track config the byte gate measures. The head is the `adapter`
 * slot every track config has; the tail names a sub-adapter slot on whatever
 * adapter schema sits there, which no type reaches from here.
 */
export type ByteGateAdapterPath = readonly ['adapter', ...string[]]

/** The whole of what `RegionTooLargeMixin` needs a composing display to be. */
export interface RegionTooLargeHost {
  configuration: RegionTooLargeConfigModel
  /** `FetchMixin`'s: the retry every composing display carries, which `forceLoad` runs after the approval */
  reload: () => void
  /**
   * `FetchMixin`'s settings axis, which both foundations compose beside this
   * mixin. A term of the measurement, never of the budget — see
   * `gateViewport`.
   */
  settingsFetchInputs: unknown
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
      gateMeasuredViewportKey: undefined as unknown,
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
      get byteGateAdapterPath(): ByteGateAdapterPath {
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
       * The span on screen, or undefined until the view is measured — the half
       * of {@link gateViewport} that every budget question needs and the
       * identity half that only a staleness compare does.
       *
       * Split off because the identity is a string joined over
       * `view.visibleRegions`, which rebuilds on every frame of every gesture,
       * and `aboveForceLoadFloor` → `gateByteLimit` → `resolvedByteLimit()` →
       * `tooLargeStatus` is read by both fetch autoruns. Every gated display
       * therefore rebuilt that string per frame to answer "is the span at
       * least 20 kb". The key is built where it is compared instead, which is
       * once per fetch and, on the banner path, only while the banner is up.
       */
      get gateViewportSpanBp(): number | undefined {
        const view = containingHost(self)
        return view.initialized ? view.visibleBp : undefined
      },
      /**
       * #getter
       * What a measurement taken now would be about: the span on screen, and a
       * key for the stretch of genome it covers **and the settings it would be
       * taken under**. Undefined until the view is measured, and with
       * {@link gateViewportSpanBp} the mixin's only read of the view. Captured
       * before the fetch's round trip, never at commit, so the stamp names the
       * settings the worker actually counted under.
       *
       * The settings term is `settingsFetchInputs`, the axis every family
       * invalidates data on. It belongs in the measurement because the worker's
       * density probe counts ADMITTED features (`densityGate`'s `admit`), so a
       * filter admitting almost nothing is a different measurement of the same
       * viewport — and while staleness was viewport-only, the main thread never
       * went back to ask. The byte axis is an index read no `rpcProps` field can
       * move; the rule is one rule rather than one per axis.
       */
      get gateViewport(): GateViewport | undefined {
        const spanBp = this.gateViewportSpanBp
        if (spanBp === undefined) {
          return undefined
        }
        const regions = containingHost(self)
          .visibleRegions.map(
            r =>
              `${r.displayedRegionIndex}:${r.refName}:${Math.floor(r.start)}-${Math.ceil(r.end)}`,
          )
          .join(',')
        return {
          spanBp,
          key: { regions, settings: host(self).settingsFetchInputs },
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the span on screen is at or above `AUTO_FORCE_LOAD_BP`, the one
       * comparison against that constant. False on an unmeasured view.
       */
      get aboveForceLoadFloor(): boolean {
        const spanBp = self.gateViewportSpanBp
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
       * (`ClearGateMeasurementsOnNavOrTierSwap`) rather than marking it stale.
       */
      get gateMeasurementStale(): boolean {
        return !isDataCurrent(
          self.gateMeasuredViewportKey,
          self.gateViewport?.key,
        )
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
          self.gateViewportSpanBp !== undefined
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
          tierKey: self.gateEnabled ? self.byteGateAdapterConfig : undefined,
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
       * Overridable hook (no-op base): drop what the *other* axis measured,
       * on the one trigger that invalidates this one. `CanvasFeatureGateMixin`
       * fills it with its per-region feature counts.
       *
       * A hook rather than a second autorun beside it, because the two axes
       * answer one question — `tooLargeStatus` reads bytes and then density —
       * and a measurement of either describes one file at one viewport. They
       * used to clear on different triggers, the byte estimate on navigation
       * *and* a tier swap and the density counts on navigation alone, so
       * re-pointing a track's adapter dropped the bytes and left
       * `densityTooLarge` speaking for the previous file until the refetch
       * landed: "Too many features" standing over a track that no longer had
       * them.
       */
      clearGateMeasurements() {},

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
       * The byte axis of a finished fetch: the per-region max against the
       * `gateFetchState()` captured at issue. An empty batch, or an ungated
       * display, commits nothing.
       *
       * **Reached through `openGateCommit` (`gateCommit.ts`), which is the only
       * production caller.** That object owns the capture, the
       * commit-at-most-once rule and the pairing of the bytes with `partial` —
       * a claim that was a trailing optional here, which is how three of the
       * four runners came to commit a number without saying whether it covered
       * the region set they asked about. A test staging a measurement by hand
       * calls this directly, which is what the default is for.
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
            currentTierKey: self.byteGateAdapterConfig,
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
            void self.byteGateAdapterConfig
            self.clearByteEstimate()
            self.clearGateMeasurements()
          },
          { name: 'ClearGateMeasurementsOnNavOrTierSwap' },
        )
      },
    }))
}
