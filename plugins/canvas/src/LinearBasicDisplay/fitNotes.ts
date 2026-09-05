import type { FitStage } from './fitLadder.ts'

// `names`/`descriptions` are relative to what was reserved, so a rung
// dropping descriptions nobody turned on drops nothing.
export interface FitDrops {
  names: 'none' | 'some' | 'all'
  descriptions: boolean
  subfeatureLabels: boolean
  everyLabel: boolean
  squeezePct: number | undefined
}

export function fitDrops(
  stage: Pick<
    FitStage,
    'level' | 'scale' | 'showLabels' | 'showDescriptions' | 'dropBelowLabelRows'
  >,
  showLabels: boolean,
  showDescriptions: boolean,
  // Factor 0 drops no name and the rung reaches it legitimately, since the
  // unseeded pack can fit where the seeded `labels` pack did not; any factor
  // above 0 means at least one name went.
  decimatedFactor: number | undefined,
): FitDrops {
  const names = !showLabels
    ? 'none'
    : !stage.showLabels
      ? 'all'
      : stage.level === 'decimated' && (decimatedFactor ?? 0) > 0
        ? 'some'
        : 'none'
  const descriptions = showDescriptions && !stage.showDescriptions
  const pct = Math.round(stage.scale * 100)
  return {
    names,
    descriptions,
    subfeatureLabels: stage.dropBelowLabelRows,
    everyLabel:
      (names === 'all' || (descriptions && !showLabels)) &&
      (descriptions || !showDescriptions),
    squeezePct: pct < 100 ? pct : undefined,
  }
}

function hiddenKinds({ names, descriptions, subfeatureLabels }: FitDrops) {
  return [
    names === 'all' ? 'names' : names === 'some' ? 'some names' : undefined,
    descriptions ? 'descriptions' : undefined,
    subfeatureLabels ? 'subfeature labels' : undefined,
  ]
    .filter(Boolean)
    .join(' + ')
}

// No " — " inside: that is the tooltip's own segment separator.
export function fitLadderNote(drops: FitDrops) {
  const hidden = hiddenKinds(drops)
  const parts = [
    hidden ? `${hidden} hidden` : undefined,
    drops.squeezePct === undefined
      ? undefined
      : `squeezed to ${drops.squeezePct}%`,
  ].filter(Boolean)
  return parts.length
    ? `${parts.join(', ')} (taller track shows more)`
    : undefined
}

// Subfeature labels are their own radio, so their drop is excluded here and
// surfaced only in the track-sizing note.
export function labelsFitHint(drops: FitDrops) {
  if (drops.everyLabel) {
    return 'hidden to fit'
  }
  const hidden = hiddenKinds({ ...drops, subfeatureLabels: false })
  return hidden ? `${hidden} hidden to fit` : undefined
}
