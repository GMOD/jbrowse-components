import { getConf, setConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { ScoreScaleMixin } from '@jbrowse/wiggle-core'

import type { scoreFieldConfigSchemaFields } from './scoreFieldConfigSchemaFields.ts'
import type { ConfigModelForFields } from '@jbrowse/core/configuration'
import type { scoreAxisConfigSchemaFields } from '@jbrowse/wiggle-core'

/**
 * The one slot this mixin reads that no shared field table holds. The score
 * axis table carries the rest; `scatterPointSize` cannot join it because the
 * two composers disagree about the part that is genuinely per display — a
 * wiggle point is 2px and advanced, a Manhattan point is the display's primary
 * glyph and basic. They agree about the type, which is all the cast needs.
 *
 * A runtime value rather than a bare type so the restatement can be checked
 * against the real declarations — see `legendMixinSlots` for why, and
 * `RestatedMixinSlots.test.ts` for the comparison.
 */
export const wiggleScoreConfigExtraSlots = {
  scatterPointSize: { type: 'number', defaultValue: 2 },
} as const

type WiggleScoreConfigModel = ConfigModelForFields<
  typeof scoreAxisConfigSchemaFields &
    typeof scoreFieldConfigSchemaFields &
    typeof wiggleScoreConfigExtraSlots
>

// The mixin composes onto a display that supplies these props, but they're
// declared by the concrete display, not here, so `self` isn't typed with them.
// This is the shared read/write handle for `getConf` and `setConf`. Mirrors
// TrackHeightMixin's cast idiom, narrowed to the sibling field table rather
// than `AnyConfigurationModel` so the slot names stay checked.
//
// Exactly the slots read below, and NOT the whole wiggle table: naming that
// table made every wiggle-only slot typecheck here, and this mixin's other
// composer is `LinearManhattanDisplay`, whose schema declares none of them.
// `getConf` on an undeclared slot returns `undefined` and reports nothing at any
// layer, so that is a silent wrong value — which is exactly how `symlogConstant`
// shipped on this mixin once already (it now lives on `WiggleCommonMixin`, whose
// host really does hold the slot). `HostChecksSlotNames` cannot catch it: it
// asks whether the names are checked, not whether both composers declare them.
export type ConfNode = { configuration: WiggleScoreConfigModel }
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
 * (`ScoreScaleMixin`), the cross-hatch toggle and the scatter point size.
 * Config only. The strict-`bpPerPx` fetch rule (adr-008) belongs to
 * `WiggleCommonMixin`, as its `zoomFetchKey`, because it describes what a
 * fetch returns rather than how a plot is drawn — `LinearManhattanDisplay`
 * composes this mixin for the score axis and fetches untransformed SNPs.
 *
 * Deliberately NOT the wiggle-specific palette, rendering-type, summary-mode
 * and resolution config either — those moved to `WiggleCommonMixin`, which
 * composes this, when it became clear that `LinearManhattanDisplay` (the other
 * composer) reads none of them and was inheriting a config schema that
 * advertised twelve slots doing nothing on a Manhattan plot. Relocation rather
 * than a new mixin layer: `types.compose` depth is a real ceiling in these
 * chains (ADR-041).
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
    .views(self => ({
      /**
       * #getter
       */
      get scatterPointSize(): number {
        return getConf(confNode(self), 'scatterPointSize')
      },
      /**
       * #getter
       * The feature field the worker plots on the score axis, `score` by
       * default. A fetch input: every composing display carries it in its
       * `rpcProps()`, since the field is read where the features are.
       */
      get scoreField(): string {
        return getConf(confNode(self), 'scoreField')
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
      setScatterPointSize(val?: number) {
        setConf(confNode(self), 'scatterPointSize', val)
      },
    }))
    .views(self => ({
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
