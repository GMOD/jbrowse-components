import { getConf, getConfResolved } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { HeightMode } from './heightMode.ts'
import type { PromotableDisplay } from '@jbrowse/core/configuration'

/**
 * #stateModel HeightModeMixin
 * #category display
 *
 * The resolved track-height views every display with a promotable `heightMode`
 * config slot shares (the canvas feature display, the alignments display), so the
 * fixed/grow/fit vocabulary is identical by construction rather than by two call
 * sites that happen to agree. Each display layers its own `grownHeight` and
 * `height` override on top — those differ (canvas fits a feature stack, alignments
 * a grouped pileup) — but the flags below are pure functions of the slot.
 *
 * `heightMode` is the single source of truth (resolved through the promotable
 * session-default cascade); `autoHeight`/`fitHeightToDisplay` are plain-flag
 * conveniences derived from it. `fitTargetHeight` is the raw drag-resizable
 * `height` slot, read by the fit/grow layout machinery INSTEAD of the reactive
 * `height` getter: in grow mode `height` returns the content-derived grown height,
 * so routing the layout through it would make that height depend on itself (a MobX
 * computed cycle). In fixed/fit mode `fitTargetHeight` equals `height`.
 */
export default function HeightModeMixin<
  TConf extends PromotableDisplay = PromotableDisplay,
>() {
  return types
    .model({})
    .views(self => ({
      /**
       * #getter
       * The resolved track-height strategy (`fixed`/`grow`/`fit`). Promotable
       * sentinel slot: getConfResolved walks the pinned-track -> session-default
       * -> `fixed` cascade and never returns the `inherit` sentinel.
       */
      get heightMode(): HeightMode {
        return getConfResolved<HeightMode>(
          self as unknown as TConf,
          'heightMode',
        )
      },
      /**
       * #getter
       * The drag-resizable track height as stored in the config slot — the fit
       * target the fit/grow layout scales or packs content into. Read there
       * instead of the reactive `height` getter to break the grow-mode cycle
       * (`height`->grownHeight->layout->height). Equals `height` in fixed/fit.
       */
      get fitTargetHeight(): number {
        return getConf(self as unknown as TConf, 'height') as number
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `grow` mode as a boolean, derived from the unified `heightMode` slot.
       */
      get autoHeight(): boolean {
        return self.heightMode === 'grow'
      },
      /**
       * #getter
       * `fit` mode as a boolean, derived from the unified `heightMode` slot.
       */
      get fitHeightToDisplay(): boolean {
        return self.heightMode === 'fit'
      },
    }))
}

/**
 * Leaving grow mode: bake the current grown height into the `height` slot so
 * fixed/fit start from the height the user was seeing. Grow computes `height`
 * reactively and never writes the slot, so without this the track would snap to
 * the stale slot default on the switch. Guarded on `viewInitialized` so
 * `grownHeight`'s transitive view-geometry reads are safe. Call from
 * `setHeightMode` BEFORE writing the new slot, so `autoHeight` still reflects the
 * mode being left.
 */
export function bakeGrownHeightOnExit(
  self: {
    autoHeight: boolean
    grownHeight: number
    setHeight: (height: number) => number
  },
  mode: HeightMode,
  viewInitialized: boolean,
) {
  if (self.autoHeight && mode !== 'grow' && viewInitialized) {
    self.setHeight(self.grownHeight)
  }
}
