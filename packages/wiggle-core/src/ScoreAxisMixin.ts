import { types } from '@jbrowse/mobx-state-tree'

import { computeYTicks } from './computeYTicks.ts'

import type { ValueScale, YAxis } from '@jbrowse/display-ui'

/**
 * #stateModel ScoreAxisMixin
 * #category display
 * #crossCuttingMixin Score axis, without a home for it. Nothing — no config slots. Brings the derived half of {@link ScoreScaleModel}: `*Bound` / `hasManualScoreBounds` / `defaultScoreDomain` / `valueScales` / `axes`, over the `scaleType` and `manual*` a composer answers
 *
 * The axis contract apart from where it is written down. `scaleType`,
 * `manualMinScore` and `manualMaxScore` are declared here with neutral answers
 * and a composing display overrides them, so the bounds, the "is anything
 * pinned" question, the ticks and the cross-hatches derive the same way
 * wherever the declaration lives. {@link ScoreScaleMixin} is the composer that
 * backs them with `scoreAxisConfigSchemaFields`, which is what wiggle, the
 * multi-wiggle, Manhattan and the alignments coverage band each take; the mark
 * display backs the same three from its own `scales.y` sub-schema instead.
 *
 * The setters are not here. A display cannot set what it has not said where to
 * put, so `setScaleType`/`setMinScore`/`setMaxScore` belong to whichever
 * composer owns the declaration — one owner, whichever it is.
 */
export function ScoreAxisMixin() {
  return types
    .model('ScoreAxisMixin', {})
    .views(() => ({
      /**
       * #getter
       * Overridable: where this display's scale type is written down.
       */
      get scaleType(): string {
        return 'linear'
      },
      /**
       * #getter
       * Overridable: the lower bound the config really pins, `undefined`
       * where nothing does.
       */
      get manualMinScore(): number | undefined {
        return undefined
      },
      /**
       * #getter
       * Overridable: the upper bound the config really pins.
       */
      get manualMaxScore(): number | undefined {
        return undefined
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
       * re-resolving the sentinels, which is the one thing that must not be
       * duplicated: config bounds still win, precisely because they are checked
       * before this is consulted.
       */
      get defaultScoreDomain(): [number | undefined, number | undefined] {
        return [undefined, undefined]
      },
      /**
       * #getter
       * Overridable hook (default none): the scales this display draws its y
       * through. A display that answers it gets an axis per band of each,
       * with its cross-hatches, placed by `DisplayChrome` and
       * `renderDisplaySvg`, and the ticks derived below.
       */
      get valueScales(): ValueScale[] {
        return []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Resolved lower bound; `undefined` means autoscale this end.
       */
      get minScoreBound(): number | undefined {
        return self.manualMinScore ?? self.defaultScoreDomain[0]
      },
      /**
       * #getter
       * Resolved upper bound; `undefined` means autoscale this end.
       */
      get maxScoreBound(): number | undefined {
        return self.manualMaxScore ?? self.defaultScoreDomain[1]
      },
      /**
       * #getter
       * Whether the user has pinned either end, which is a different question
       * from whether either end resolved to a number: `defaultScoreDomain` fills
       * the unset ends in, so a GC content track answers yes to the second with
       * nothing configured. The score menu asks this one — it gates the "Clear
       * manual min/max" row, and a Clear that writes the nothing already there
       * is a row that does nothing and never goes away.
       */
      get hasManualScoreBounds(): boolean {
        return (
          self.manualMinScore !== undefined || self.manualMaxScore !== undefined
        )
      },
      /**
       * #getter
       * The axes, one per declared scale whose domain resolved: where each
       * tick lands in the band's own pixel space, through `computeYTicks`
       * unless the scale brought its own ladder.
       */
      get axes(): YAxis[] {
        return self.valueScales.flatMap(scale => {
          const { domain } = scale
          const ticks =
            scale.ticks ??
            computeYTicks({
              height: scale.height,
              offset: scale.offset,
              domain,
              scaleType: scale.scaleType,
              minimalTicks: scale.minimalTicks ?? false,
              symlogConstant: scale.symlogConstant,
            })
          return domain && ticks ? [{ ...scale, domain, ticks }] : []
        })
      },
    }))
}
