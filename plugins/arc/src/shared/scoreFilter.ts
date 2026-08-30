import { makeSizeMenu } from '@jbrowse/core/ui'

import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

export interface ScoreRange {
  min: number
  max: number
}

// The span of `score` across the loaded features, which is what the slider is
// laid out over: arc scores are whatever the file says — read counts, VCF QUAL,
// a bedpe column — so unlike the sashimi filter (read support, always a small
// count) there is no meaningful fixed range to hard-code.
//
// `undefined` when no feature carries a numeric score, or when they all carry
// the same one: a slider whose ends mean the same thing filters nothing, and the
// menu leaves the row out rather than showing a dead control.
export function featureScoreRange(features: Feature[]) {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const feature of features) {
    const score = feature.get('score')
    if (typeof score === 'number') {
      min = Math.min(min, score)
      max = Math.max(max, score)
    }
  }
  return min < max ? { min, max } : undefined
}

// Features with no numeric `score` always draw. The threshold is a statement
// about an attribute, so a feature that doesn't carry it isn't a candidate for
// it — and a mixed file would otherwise blank its scoreless half the moment the
// slider left 0, with the menu giving no hint why.
export function filterByScore<T extends Feature>(
  features: T[],
  minScore: number,
) {
  return features.filter(feature => {
    const score = feature.get('score')
    return typeof score === 'number' ? score >= minScore : true
  })
}

interface ScoreFilterModel {
  minScore: number
  setMinScore: (score: number) => void
  scoreRange: ScoreRange | undefined
}

// The slider bottoms out at 0 rather than at the data's own minimum, so the
// default value is a real "show everything" for the scores that are counts or
// quality — which is nearly all of them. Data that goes negative gets the wider
// track, where 0 is then a threshold like any other and the arcs below it are
// reached by dragging past it.
export function makeScoreFilterMenuItem(
  model: ScoreFilterModel,
  range: ScoreRange,
): MenuItem {
  const min = Math.min(0, Math.floor(range.min))
  const max = Math.ceil(range.max)
  const span = max - min
  return makeSizeMenu({
    label: 'Filter by score',
    title: 'Min score',
    min,
    max,
    // a hundred notches across the span, but never finer than 1 where the
    // scores are counts and a fractional threshold means nothing
    step: span > 100 ? 1 : span / 100,
    format: n => (Number.isInteger(n) ? `${n}` : n.toFixed(2)),
    // main-thread canvas repaint over already-fetched features, so live
    getValue: () => model.minScore,
    isDefault: model.minScore === 0,
    onChange: score => {
      model.setMinScore(score)
    },
    onReset: () => {
      model.setMinScore(0)
    },
  })
}
