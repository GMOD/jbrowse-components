import { getConf } from '@jbrowse/core/configuration'

import {
  AUTO_FORCE_LOAD_BP,
  evaluateRegionTooLarge,
  resolveByteLimit,
} from './regionTooLargeUtils.ts'

import type { RegionTooLargeConfigModel } from './regionTooLargeConfigSchemaFields.ts'
import type { ByteEstimate } from './regionTooLargeUtils.ts'

/**
 * What the gate's config reads need: a display, or a static host carrying a
 * display's config.
 */
export interface RegionTooLargeConfigHost {
  configuration: RegionTooLargeConfigModel
}

/**
 * The gate's two config slots, from `regionTooLargeConfigSchemaFields`.
 */
export function regionTooLargeConfigViews(self: RegionTooLargeConfigHost) {
  return {
    /**
     * #getter
     * The display's `fetchSizeLimit` slot, from
     * `regionTooLargeConfigSchemaFields`. `number | undefined`, because
     * `getConf` returns `undefined` for a slot a composing display's schema
     * never declared, which typing it `number` would hide —
     * `resolveByteLimit` falls back closed, and reports why.
     */
    get configuredFetchSizeLimit(): number | undefined {
      return getConf(self, 'fetchSizeLimit')
    },
    /**
     * #getter
     * The declarative `forceLoad` slot.
     */
    get configForceLoad(): boolean {
      return getConf(self, 'forceLoad')
    },
  }
}

/**
 * The leaves the gate's verdict and budget are derived from. The live
 * display answers them from its view, its track's adapter config and its
 * fetch commits; a static host answers them from its frame, the adapter
 * config it fetched through and that fetch's measurement:
 *
 * - `gateEnabled` and `densityTooLarge`: the display's hooks, installed as
 *   the display installs them.
 * - `configForceLoad` and `configuredFetchSizeLimit`:
 *   `regionTooLargeConfigViews` over the display's config.
 * - `adapterFetchSizeLimit`: the measured adapter's own `fetchSizeLimit`,
 *   read with its schema's default.
 * - `forceLoadTrack`: the banner button's approval, false where there is no
 *   button.
 * - `gateViewportSpanBp`: the span the frame shows, undefined until there is
 *   one.
 * - `byteEstimate`: the fetch's measurement, undefined until it reports one.
 */
export interface RegionTooLargeGateHost {
  readonly gateEnabled: boolean
  readonly densityTooLarge: boolean
  readonly configForceLoad: boolean
  readonly configuredFetchSizeLimit: number | undefined
  readonly adapterFetchSizeLimit: number | undefined
  readonly forceLoadTrack: boolean
  readonly gateViewportSpanBp: number | undefined
  readonly byteEstimate: ByteEstimate | undefined
}

export function regionTooLargeFloorViews(self: RegionTooLargeGateHost) {
  return {
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
  }
}

type GateFloorHost = RegionTooLargeGateHost &
  ReturnType<typeof regionTooLargeFloorViews>

export function regionTooLargeBudgetViews(self: GateFloorHost) {
  return {
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
  }
}

type GateBudgetHost = GateFloorHost &
  ReturnType<typeof regionTooLargeBudgetViews>

export function regionTooLargeActiveViews(self: GateBudgetHost) {
  return {
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
  }
}

type GateActiveHost = GateBudgetHost &
  ReturnType<typeof regionTooLargeActiveViews>

export function regionTooLargeStatusViews(self: GateActiveHost) {
  return {
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
  }
}

type GateStatusHost = GateActiveHost &
  ReturnType<typeof regionTooLargeStatusViews>

export function regionTooLargeVerdictViews(self: GateStatusHost) {
  return {
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
  }
}
