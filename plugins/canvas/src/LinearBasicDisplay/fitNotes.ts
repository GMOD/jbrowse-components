import type { FitStage } from './fitLadder.ts'

// What the fit ladder took away from the labels the settings asked for, and
// how far it squeezed the boxes. `names`/`descriptions` are relative to what was
// RESERVED — a rung dropping descriptions nobody turned on drops nothing — so a
// track outside fit mode, or one that fits at `full`, reads as no drops at all.
export interface FitDrops {
  names: 'none' | 'some' | 'all'
  descriptions: boolean
  // every label kind the settings reserved is gone
  everyLabel: boolean
  // the squeeze as a whole percentage under 100, or undefined when not squeezing
  squeezePct: number | undefined
}

export function fitDrops(
  stage: Pick<FitStage, 'level' | 'scale'>,
  showLabels: boolean,
  showDescriptions: boolean,
): FitDrops {
  const names = !showLabels
    ? 'none'
    : stage.level === 'bodies'
      ? 'all'
      : stage.level === 'decimated'
        ? 'some'
        : 'none'
  const descriptions = showDescriptions && stage.level !== 'full'
  const pct = Math.round(stage.scale * 100)
  return {
    names,
    descriptions,
    everyLabel:
      (names === 'all' || (descriptions && !showLabels)) &&
      (descriptions || !showDescriptions),
    squeezePct: pct < 100 ? pct : undefined,
  }
}

function hiddenKinds({ names, descriptions }: FitDrops) {
  return [
    names === 'all' ? 'names' : names === 'some' ? 'some names' : undefined,
    descriptions ? 'descriptions' : undefined,
  ]
    .filter(Boolean)
    .join(' and ')
}

// The track-sizing control's account of the ladder, or undefined when it gave
// nothing up. Names the lever as well as the loss: the user chose fit mode (or
// inherited it), and "hidden to fit" alone reads as the track having no labels.
export function fitLadderNote(drops: FitDrops) {
  const hidden = hiddenKinds(drops)
  const parts = [
    hidden ? `${hidden} hidden` : undefined,
    drops.squeezePct === undefined
      ? undefined
      : `squeezed to ${drops.squeezePct}%`,
  ].filter(Boolean)
  return parts.length
    ? `${parts.join(', ')} to fit (a taller track shows more)`
    : undefined
}

// The note on the selected "Labels" radio: the row names a setting the ladder
// is not honouring. "hidden to fit" when nothing the row reserved survives,
// else which part went — same shape as the collapsed-mode note beside it.
export function labelsFitHint(drops: FitDrops) {
  if (drops.everyLabel) {
    return 'hidden to fit'
  }
  const hidden = hiddenKinds(drops)
  return hidden ? `${hidden} hidden to fit` : undefined
}
