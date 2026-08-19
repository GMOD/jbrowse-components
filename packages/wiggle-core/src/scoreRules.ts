import { clampStrokeInsideAxis, scoreToAxisY } from './yScaleTicks.ts'

/**
 * #api
 * One horizontal rule across a score plot, at a score the user chose.
 *
 * `label` is free text and carries no meaning this package assigns. That is
 * deliberate: the obvious use is reading a coverage or CNV track against copy
 * number, and there is no ploidy JBrowse could assume on the user's behalf. A
 * whole-genome triplication is not diploid, plenty of genomes are not diploid to
 * begin with, and a cancer sample can be neither — so "2 copies" is a claim only
 * the person looking at the track can make.
 */
export interface ScoreRule {
  value: number
  label?: string
  color?: string
}

export interface ScoreRuleMark extends ScoreRule {
  y: number
}

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
 * display's ticks were built with (a `YScaleTicks` satisfies it). Recomputing a
 * box here would silently disagree with any band that lays its axis out
 * differently, and the alignments coverage band does.
 */
export function scoreRuleMarks({
  rules,
  domain,
  box,
  normalize,
}: {
  rules: readonly ScoreRule[]
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
 * Normalizes whatever a `scoreRules` config slot holds into `ScoreRule`s,
 * dropping entries that are not usable. Config is user-authored JSON, so a bare
 * number, a missing value or a non-numeric one all have to survive being read.
 */
export function parseScoreRules(value: unknown): ScoreRule[] {
  if (!Array.isArray(value)) {
    return []
  }
  const out: ScoreRule[] = []
  for (const entry of value) {
    if (typeof entry === 'number') {
      if (Number.isFinite(entry)) {
        out.push({ value: entry })
      }
      continue
    }
    if (entry && typeof entry === 'object') {
      const { value: v, label, color } = entry as Record<string, unknown>
      const n = typeof v === 'string' ? Number(v) : v
      if (typeof n === 'number' && Number.isFinite(n)) {
        out.push({
          value: n,
          ...(typeof label === 'string' && label ? { label } : {}),
          ...(typeof color === 'string' && color ? { color } : {}),
        })
      }
    }
  }
  return out
}

/**
 * #api
 * Widens an autoscaled range so every configured rule stays on the axis.
 *
 * Without this a rule silently disappears in exactly the window that makes it
 * worth having. Autoscale follows the visible data, so over a homozygous
 * deletion a coverage domain collapses to about `[0, 1]` and a rule at the
 * diploid depth falls outside it — and "2 copies would be up there" is the most
 * informative thing that view can say. The reader has no menu to check either:
 * `scoreRules` is set by whoever wrote the config, so a rule that vanishes
 * leaves nothing behind to notice.
 *
 * Applied to the raw range, before `getNiceDomain` takes the `minScore` /
 * `maxScore` bounds. Those still win: a rule outside an explicitly bounded axis
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
