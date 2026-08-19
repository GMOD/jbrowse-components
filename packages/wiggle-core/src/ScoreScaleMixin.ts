import { getConf, setConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { ScoreAxisConfigModel } from './scoreAxisConfigSchemaFields.ts'

/**
 * The whole of what `ScoreScaleMixin` needs a composing display to be. Exported
 * because it is the mixin's contract and `ScoreScaleMixin.test.ts` pins it:
 * widen it and the `@ts-expect-error`s there go unused.
 */
export interface ScoreScaleHost {
  configuration: ScoreAxisConfigModel
}

// The mixin composes onto a display that declares this, not the other way
// round, so its own `self` isn't typed with it. Cast once — the same idiom
// `TrackHeightMixin` and `WiggleScoreConfigMixin` use — and narrowed to the
// field table beside it rather than `AnyConfigurationModel`, which is what
// keeps the slot names below checked.
const confNode = (self: object) => self as ScoreScaleHost

/**
 * #stateModel ScoreScaleMixin
 * #category display
 * #crossCuttingMixin Score axis. Nothing — the config slots. Brings `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `*Bound` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume
 *
 * The score axis every quantitative display shares: which scale, how to
 * autoscale it, and the manual min/max bounds. This is the runtime half of
 * {@link ScoreScaleModel} in `scoreMenuItems.ts` — that interface is what the
 * shared Score menu, the autoscale/scale submenus and `SetMinMaxDialog` consume,
 * and it was already the canonical contract while two displays hand-wrote
 * identical implementations of it (`WiggleScoreConfigMixin`, and the alignments
 * coverage band). Composing this is now how a display satisfies it, so a new
 * score display cannot satisfy it *partially*.
 *
 * Deliberately just the axis. Colors, `resolution`, cross-hatches and the
 * autoscale *computation* stay in `WiggleScoreConfigMixin` / `WiggleCommonMixin`
 * — the alignments coverage band shares this axis but none of the rest.
 *
 * `minScore`/`maxScore` are the **raw** slot values with their
 * `Number.MIN_VALUE`/`Number.MAX_VALUE` "unset" sentinels intact, because that
 * is what the dialog round-trips; `minScoreBound`/`maxScoreBound` are the
 * resolved bounds, where `undefined` means "autoscale this end". Every consumer
 * that computes a domain reads the `*Bound` pair.
 */
export function ScoreScaleMixin() {
  return types
    .model('ScoreScaleMixin', {})
    .views(self => ({
      /**
       * #getter
       */
      get scaleType(): string {
        return getConf(confNode(self), 'scaleType')
      },
      /**
       * #getter
       */
      get autoscaleType(): string {
        return getConf(confNode(self), 'autoscale')
      },
      /**
       * #getter
       */
      get numStdDev(): number {
        return getConf(confNode(self), 'numStdDev')
      },
      /**
       * #getter
       * Raw slot value, sentinel intact — see the class comment.
       */
      get minScore(): number {
        return getConf(confNode(self), 'minScore')
      },
      /**
       * #getter
       * Raw slot value, sentinel intact — see the class comment.
       */
      get maxScore(): number {
        return getConf(confNode(self), 'maxScore')
      },
      /**
       * #getter
       * Overridable hook: what each end of the domain falls back to where the
       * config leaves its bound unset. `[undefined, undefined]` — the default —
       * means autoscale both ends, which is right for a track whose scores have
       * no absolute meaning (a bigwig's units are its own).
       *
       * A display whose scores are bounded *by construction* overrides it, so
       * the axis stops being a function of what happens to be on screen: GC
       * content is a fraction, so 0 and 1 are its real limits and mean the same
       * thing at every locus. Autoscaled, the same GC value drew at different
       * heights depending on where the user had panned, and the track could not
       * be read across loci.
       *
       * A hook rather than a config default because the answer can depend on
       * display state — GC's does, on `gcMode` — and rather than each display
       * re-resolving the sentinels below, which is the one thing that must not
       * be duplicated: config bounds still win, precisely because they are
       * checked before this is consulted.
       */
      get defaultScoreDomain(): [number | undefined, number | undefined] {
        return [undefined, undefined]
      },
      /**
       * #getter
       * Resolved lower bound; `undefined` means autoscale this end.
       */
      get minScoreBound(): number | undefined {
        const val: number = getConf(confNode(self), 'minScore')
        return val === Number.MIN_VALUE ? this.defaultScoreDomain[0] : val
      },
      /**
       * #getter
       * Resolved upper bound; `undefined` means autoscale this end.
       */
      get maxScoreBound(): number | undefined {
        const val: number = getConf(confNode(self), 'maxScore')
        return val === Number.MAX_VALUE ? this.defaultScoreDomain[1] : val
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setScaleType(scaleType: string) {
        setConf(confNode(self), 'scaleType', scaleType)
      },
      /**
       * #action
       */
      setAutoscale(val?: string) {
        setConf(confNode(self), 'autoscale', val)
      },
      /**
       * #action
       */
      setMinScore(val?: number) {
        setConf(confNode(self), 'minScore', val)
      },
      /**
       * #action
       */
      setMaxScore(val?: number) {
        setConf(confNode(self), 'maxScore', val)
      },
    }))
}
