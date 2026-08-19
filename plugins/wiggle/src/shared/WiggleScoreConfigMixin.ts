import { getConf, resolveConf, setConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { ScoreScaleMixin } from '@jbrowse/wiggle-core'

import type { WiggleConfigModel } from './wiggleConfigSchemaFields.ts'
import type { ResolvableDisplay } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The mixin composes onto a display that supplies these props, but they're
// declared by the concrete display, not here, so `self` isn't typed with them.
// This is the shared read/write handle for `getConf`, `setConf` and
// `resolveConf`. Mirrors TrackHeightMixin's cast idiom, narrowed to the sibling
// field table rather than `AnyConfigurationModel` so the slot names stay
// checked.
//
// It extends `ResolvableDisplay` rather than declaring `configuration` alone
// because two of the slots read through it (`scatterPointSize`, `lineWidth`) are
// promotable, and the cascade keys the session-wide tier on `type`. Every display
// this composes onto is a BaseDisplay, so both members are really there — the
// cast is about what the *mixin* can see, not about what the node has.
export type ConfNode = ResolvableDisplay<WiggleConfigModel>
export const confNode = (self: object) => self as ConfNode

// Resolution is a multiplier on the number of bins fetched (higher = finer),
// stepped multiplicatively. Only the coarser side needs a floor to avoid
// degenerate binning; the finer side is self-limiting (bbi caps at raw
// per-base data, so past that threshold more resolution returns identical
// data), and the high ceiling lets whiskers reach raw at wider zooms. Exported
// so the track-menu stepper disables at the same edges setResolution clamps to
// instead of silently no-op'ing.
export const RESOLUTION_MIN = 1 / 16
export const RESOLUTION_MAX = 1024
export const RESOLUTION_STEP = 2

/**
 * #stateModel WiggleScoreConfigMixin
 * #category display
 *
 * The score-PLOT config every wiggle-family display shares: the score axis
 * (`ScoreScaleMixin`), the cross-hatch toggle, the scatter point size and the
 * zoom-staleness cache test. Deliberately NOT the wiggle-specific palette,
 * rendering-type, summary-mode and resolution config — those moved to
 * `WiggleCommonMixin`, which composes this, when it became clear that
 * `LinearManhattanDisplay` (the other composer) reads none of them and was
 * inheriting a config schema that advertised twelve slots doing nothing on a
 * Manhattan plot. Relocation rather than a new mixin layer: `types.compose`
 * depth is a real ceiling in these chains (ADR-041).
 *
 * A display that owns its own rpcDataMap type composes this; a wiggle-shaped
 * one composes `WiggleCommonMixin`.
 *
 * The score *axis* itself (scaleType / autoscale / min-max and their setters) is
 * `ScoreScaleMixin`, composed in below and shared with the alignments coverage
 * band, which wants that axis and none of the color/resolution config here.
 */
export function WiggleScoreConfigMixin() {
  return types
    .compose('WiggleScoreConfigMixin', ScoreScaleMixin(), types.model({}))
    .volatile(() => ({
      /**
       * #volatile
       */
      loadedBpPerPx: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get scatterPointSize(): number {
        return resolveConf(confNode(self), 'scatterPointSize')
      },
      /**
       * #getter
       * The configured cross-hatch setting. A config slot rather than a display
       * prop — like `scatterPointSize` beside it — because a prop cannot be set
       * from a config at all: MST drops a snapshot key the schema never
       * declares, so `demos/cgiab` had asked for hatches on its CNV track and
       * never got them. Read `showCrossHatches` below for what actually draws;
       * this is the raw setting the menu toggles.
       */
      get displayCrossHatches(): boolean {
        return getConf(confNode(self), 'displayCrossHatches')
      },
      /**
       * #getter
       * Whether score maps to color instead of height. Each display overrides
       * this from its own rendering-type table (`density` /
       * `multirowdensity`); the base is false so this mixin's resolved
       * getters below can key on it, the same override idiom
       * `autoscaleSourceNames` uses in WiggleCommonMixin.
       */
      get isDensityMode(): boolean {
        return false
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      toggleCrossHatches() {
        setConf(
          confNode(self),
          'displayCrossHatches',
          !self.displayCrossHatches,
        )
      },
      /**
       * #action
       */
      setLoadedBpPerPx(bpPerPx: number | undefined) {
        self.loadedBpPerPx = bpPerPx
      },
      /**
       * #action
       */
      setScatterPointSize(val?: number) {
        setConf(confNode(self), 'scatterPointSize', val)
      },
    }))
    .views(self => ({
      /**
       * #method
       * Strict zoom equality: see adr-008. A view, not an action, so the
       * `view.bpPerPx` read below actually registers as a dependency of whoever
       * calls it (see MultiRegionDisplayMixin's hook block).
       */
      isCacheValid(_displayedRegionIndex: number) {
        if (self.loadedBpPerPx === undefined) {
          return true
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        return view.bpPerPx === self.loadedBpPerPx
      },
      /**
       * #getter
       * Whether the score-axis cross hatches draw. Density spends color, not
       * height, on the score, so there is no axis for them to rule — and the
       * track menu drops the toggle there, which would strand hatches enabled
       * in another plot type with no way to turn them off. Every consumer
       * (on-screen overlay, multi-row overlay lines, SVG export) reads this,
       * never the raw `displayCrossHatches` setting.
       */
      get showCrossHatches() {
        return self.displayCrossHatches && !self.isDensityMode
      },
    }))
}
