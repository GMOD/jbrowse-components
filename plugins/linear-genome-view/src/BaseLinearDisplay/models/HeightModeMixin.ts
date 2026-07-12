import { getConf, getConfResolved } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import type { HeightMode } from './heightMode.ts'
import type { PromotableDisplay } from '@jbrowse/core/configuration'
import type { IReactionDisposer } from 'mobx'

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
 * Leaving grow mode: bake the height the user was seeing into the `height` slot
 * so fixed/fit start from it rather than snapping to the stale slot value (grow
 * computes `height` reactively and never writes the slot). A reaction rather than
 * a call inside `setHeightMode` because the resolved `heightMode` also flips
 * without any imperative action — un-pinning a grow-pinned track, or changing the
 * session-wide default out from under un-pinned grow-following tracks (the
 * promotable cascade) — and every such exit must bake. Install from `afterAttach`
 * on both displays that own a `grownHeight`.
 *
 * The captured height is `prev.grown`, computed in the tracked expression while
 * still in grow mode: by the time the effect runs the mode has flipped and
 * `grownHeight` may already reflect the new layout, so reading it there would
 * bake the wrong value. Guarded on `view.initialized` (grownHeight transitively
 * reads view geometry that throws pre-init). No loop: `setHeight` writes only the
 * `height` slot, which the expression ignores once `autoHeight` is false.
 */
export function installGrowExitBake(
  self: {
    heightMode: HeightMode
    autoHeight: boolean
    grownHeight: number
    setHeight: (height: number) => number
  },
  view: { initialized: boolean },
): IReactionDisposer {
  return reaction(
    () => ({
      mode: self.heightMode,
      grown: self.autoHeight && view.initialized ? self.grownHeight : undefined,
    }),
    (curr, prev) => {
      if (
        prev.mode === 'grow' &&
        curr.mode !== 'grow' &&
        prev.grown !== undefined
      ) {
        self.setHeight(prev.grown)
      }
    },
    { name: 'GrowExitBake' },
  )
}
