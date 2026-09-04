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
// round, so its own `self` isn't typed with it. Cast once, narrowed to the
// field table beside it rather than `AnyConfigurationModel`, which is what keeps
// the slot names below checked.
const confNode = (self: object) => self as ScoreScaleHost

/**
 * #stateModel ScoreScaleMixin
 * #category display
 * #crossCuttingMixin Score axis. Nothing — the config slots. Brings `scaleType` / `autoscaleType` / `minScore` / `maxScore` / `manual*` / `*Bound` / `hasManualScoreBounds` / `numStdDev` and their setters, i.e. the whole `ScoreScaleModel` interface the shared score menu and `SetMinMaxDialog` consume
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
 * `Number.MIN_VALUE`/`Number.MAX_VALUE` "unset" sentinels intact, and nothing
 * outside this file should want them: `manualMinScore`/`manualMaxScore` are the
 * same answer with the sentinel resolved to `undefined`, which is what the
 * dialog round-trips and what the menu captions itself with;
 * `minScoreBound`/`maxScoreBound` are the resolved bounds, where `undefined`
 * means "autoscale this end". Every consumer that computes a domain reads the
 * `*Bound` pair.
 *
 * Whether a bound is *configured* is a third question, and `hasManualScoreBounds`
 * is the only getter that answers it — the resolved pair cannot, since
 * `defaultScoreDomain` is exactly the hook that turns an unset end into a number.
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
      /**
       * #getter
       * Resolved lower bound; `undefined` means autoscale this end.
       */
      get minScoreBound(): number | undefined {
        return this.manualMinScore ?? this.defaultScoreDomain[0]
      },
      /**
       * #getter
       * Resolved upper bound; `undefined` means autoscale this end.
       */
      get maxScoreBound(): number | undefined {
        return this.manualMaxScore ?? this.defaultScoreDomain[1]
      },
      /**
       * #getter
       * Whether the user has pinned either end, which is a different question
       * from whether either end resolved to a number: `defaultScoreDomain` fills
       * the sentinels in, so a GC content track answers yes to the second with
       * nothing configured. The score menu asks this one — it gates the "Clear
       * manual min/max" row, and a Clear that writes the sentinels already
       * there is a row that does nothing and never goes away.
       */
      get hasManualScoreBounds(): boolean {
        return (
          this.manualMinScore !== undefined || this.manualMaxScore !== undefined
        )
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
