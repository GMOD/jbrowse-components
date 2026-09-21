import {
  clampStrokeInsideAxis,
  scoreToAxisY,
} from '@jbrowse/display-ui/yScaleTicks'

import type { ScoreRuleMark, ValueScaleRule } from '@jbrowse/display-ui'

export type { ScoreRuleMark } from '@jbrowse/display-ui'

/**
 * #api
 * Screen y for each rule that falls inside the plotted domain, dropping the
 * rest.
 *
 * Out-of-domain is a real case rather than a guard: the domain is whatever
 * autoscale resolved for the visible data, so panning to a quiet stretch can put
 * a rule above everything on screen, and a rule pinned to the top edge there
 * reads as "the whole view is over the line".
 *
 * `normalize` is the display's OWN score normalizer — the same one the renderer
 * draws with. It is a parameter rather than a linear interpolation of the domain
 * because the axis need not be linear: on a log or symlog track, placing a rule
 * at `(value - min) / (max - min)` puts the line somewhere the data it is meant
 * to be read against is not.
 *
 * `box` is likewise the caller's own — hand it the same `{yTop, yBottom}` the
 * display's ticks were built with (a `YScaleTicks` satisfies it). A box
 * recomputed here would place rules off the ticks of any band that lays its
 * axis out differently, and the alignments coverage band does.
 */
export function scoreRuleMarks({
  rules,
  domain,
  box,
  normalize,
}: {
  rules: readonly ValueScaleRule[]
  domain: [number, number] | undefined
  box: { yTop: number; yBottom: number }
  normalize: (score: number) => number
}): ScoreRuleMark[] {
  if (!domain) {
    return []
  }
  const [min, max] = domain
  if (max === min) {
    return []
  }
  return rules
    .filter(r => Number.isFinite(r.value) && r.value >= min && r.value <= max)
    .map(r => ({
      ...r,
      y: clampStrokeInsideAxis(
        scoreToAxisY(normalize(r.value), {
          ...box,
          plotHeight: box.yBottom - box.yTop,
        }),
        box.yBottom,
      ),
    }))
}

/**
 * #api
 * Widens an autoscaled range so every configured rule stays on the axis.
 *
 * Without this a rule is dropped from the plot in the views where it is most
 * useful. Autoscale follows the visible data, so over a homozygous deletion a
 * coverage domain collapses to about `[0, 1]` and a rule at the diploid depth
 * falls outside it, though the rule's position above the data is the most
 * informative mark in that view, and a rule that vanishes leaves nothing
 * behind to notice.
 *
 * Applied to the raw range, before `getNiceDomain` takes the `scales.y`
 * domain bounds. Those still win: a rule outside an explicitly bounded axis
 * is one the config asked not to be shown, and it drops as before.
 */
export function widenRangeToRules(
  range: [number, number],
  ruleValues: readonly number[],
): [number, number] {
  let [min, max] = range
  for (const value of ruleValues) {
    if (Number.isFinite(value)) {
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
  }
  return [min, max]
}
