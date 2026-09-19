import { getConf, setConf } from '@jbrowse/core/configuration'

import { ScoreAxisMixin } from './ScoreAxisMixin.ts'

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
// round, so its own `self` isn't typed with it. Cast once, narrowed to the
// field table beside it rather than `AnyConfigurationModel`, which is what keeps
// the slot names below checked.
const confNode = (self: object) => self as ScoreScaleHost

/**
 * #stateModel ScoreScaleMixin
 * #category display
 * #crossCuttingMixin Score axis, written in the config slots. `scoreAxisConfigSchemaFields`. Brings {@link ScoreAxisMixin} plus `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `manual*` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume
 *
 * The score axis of a display whose axis IS `minScore`, `maxScore` and
 * `scaleType`: wiggle, the multi-wiggle, Manhattan and the alignments coverage
 * band. It backs {@link ScoreAxisMixin}'s three overridable members off those
 * slots and adds the setters that write them, so composing this is how a
 * display satisfies {@link ScoreScaleModel} in `scoreMenuItems.ts` — the
 * interface the shared Score menu, the autoscale/scale submenus and
 * `SetMinMaxDialog` consume. A display that writes its scale down somewhere
 * else composes `ScoreAxisMixin` and answers the three itself, which is what
 * the mark display does with `scales.y`.
 *
 * Deliberately just the axis. Colors, `resolution`, cross-hatches and the
 * autoscale *computation* stay in `WiggleScoreConfigMixin` / `WiggleCommonMixin`
 * — the alignments coverage band shares this axis but none of the rest.
 *
 * `minScore`/`maxScore` are the **raw** slot values with their
 * `Number.MIN_VALUE`/`Number.MAX_VALUE` "unset" sentinels intact, and nothing
 * outside this file should want them: `manualMinScore`/`manualMaxScore` are the
 * same values with the sentinel resolved to `undefined`, and the dialog
 * round-trips them and the menu captions itself with them;
 * `minScoreBound`/`maxScoreBound` are the resolved bounds, where `undefined`
 * means "autoscale this end". Every consumer that computes a domain reads the
 * `*Bound` pair.
 */
export function ScoreScaleMixin() {
  return ScoreAxisMixin()
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
       * The lower bound the config really sets, `undefined` at the sentinel.
       */
      get manualMinScore(): number | undefined {
        return this.minScore === Number.MIN_VALUE ? undefined : this.minScore
      },
      /**
       * #getter
       * The upper bound the config really sets, `undefined` at the sentinel.
       */
      get manualMaxScore(): number | undefined {
        return this.maxScore === Number.MAX_VALUE ? undefined : this.maxScore
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
