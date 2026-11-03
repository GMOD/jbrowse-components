import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { FitStage } from './fitLadder.ts'
import type { LabelRoomFactors } from './layoutInputs.ts'

// `names`/`descriptions` are relative to what was reserved, so a rung
// dropping descriptions nobody turned on drops nothing.
export interface FitDrops {
  names: 'none' | 'some' | 'all'
  descriptions: boolean
  subfeatureLabels: boolean
  everyLabel: boolean
  squeezePct: number | undefined
}

export function foldsNames(layout: ReadonlyMap<number, FeatureDataResult>) {
  for (const data of layout.values()) {
    if (data.flatbushItems.some(item => item.foldedName)) {
      return true
    }
  }
  return false
}

export function fitDrops(
  stage: Pick<
    FitStage,
    | 'level'
    | 'scale'
    | 'bodyScale'
    | 'showLabels'
    | 'showDescriptions'
    | 'dropBelowLabelRows'
  >,
  showLabels: boolean,
  showDescriptions: boolean,
  // Factor 0 drops no name and the rung reaches it legitimately, since the
  // unseeded pack can fit where the seeded `labels` pack did not; any factor
  // above 0 means at least one name went.
  decimated: LabelRoomFactors | undefined,
  // A pile folded onto one row keeps one name at any factor.
  foldedNames = false,
): FitDrops {
  const names = !showLabels
    ? 'none'
    : !stage.showLabels
      ? 'all'
      : stage.level === 'decimated' &&
          (foldedNames ||
            (decimated?.labelRoomFactor ?? 0) > 0 ||
            (decimated?.geneLabelRoomFactor ?? 0) > 0)
        ? 'some'
        : 'none'
  const descriptions = showDescriptions && !stage.showDescriptions
  const pct = Math.round(stage.scale * stage.bodyScale * 100)
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

// The note on each label checkbox the ladder is not honouring. Subfeature
// labels are their own radio, so their drop is surfaced only in the
// track-sizing note.
export function labelFitHints({ names, descriptions }: FitDrops) {
  return {
    names:
      names === 'all'
        ? 'hidden to fit'
        : names === 'some'
          ? 'some hidden to fit'
          : undefined,
    descriptions: descriptions ? 'hidden to fit' : undefined,
  }
}
