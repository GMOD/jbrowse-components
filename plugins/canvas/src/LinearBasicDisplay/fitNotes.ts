import type { FitStage } from './fitLadder.ts'

// What the fit ladder took away from the labels the settings asked for, and
// how far it squeezed the boxes. `names`/`descriptions` are relative to what was
// RESERVED — a rung dropping descriptions nobody turned on drops nothing — so a
// track outside fit mode, or one that fits at `full`, reads as no drops at all.
export interface FitDrops {
  names: 'none' | 'some' | 'all'
  descriptions: boolean
  // the reserved `below` subfeature-label rows are dropped (the `bare` rung)
  subfeatureLabels: boolean
  // every label kind the settings reserved is gone
  everyLabel: boolean
  // the squeeze as a whole percentage under 100, or undefined when not squeezing
  squeezePct: number | undefined
}

export function fitDrops(
  stage: Pick<FitStage, 'level' | 'scale'>,
  showLabels: boolean,
  showDescriptions: boolean,
  // whether descriptions are actually painted at the rung that survived. Read
  // rather than inferred from the level: fixed height reaches `isoforms`
  // keeping them, fit mode only reaches it after `labels` dropped them, and one
  // level answers both.
  renderedShowDescriptions: boolean,
  // the whitespace factor the `decimated` rung committed at. Factor 0 drops no
  // name at all — `keepFeatureLabel` asks for `room >= width * 0` and no
  // overhang room is negative — and the rung reaches 0 legitimately, because
  // the unseeded pack can fit where the seeded `labels` pack did not (see
  // `solveLabelRoomFactor`). Any factor above 0 means fits(0) failed, so at
  // least one name went.
  decimatedFactor: number | undefined,
  // whether the kept rung dropped the reserved `below` subfeature-label rows —
  // the `bare` rung only exists where the settings reserve them, so its level
  // alone answers this and the caller passes exactly that.
  droppedSubfeatureLabels: boolean,
): FitDrops {
  const names = !showLabels
    ? 'none'
    : stage.level === 'bodies' || stage.level === 'bare'
      ? 'all'
      : stage.level === 'decimated' && (decimatedFactor ?? 0) > 0
        ? 'some'
        : 'none'
  const descriptions = showDescriptions && !renderedShowDescriptions
  const pct = Math.round(stage.scale * 100)
  return {
    names,
    descriptions,
    subfeatureLabels: droppedSubfeatureLabels,
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

// The track-sizing control's account of the ladder, or undefined when it gave
// nothing up. Names the lever as well as the loss: the user chose fit mode (or
// inherited it), and "hidden" alone reads as the track having no labels. No
// " — " inside: that is the tooltip's own segment separator.
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

// The note on the selected "Labels" radio: the row names a setting the ladder
// is not honouring. "hidden to fit" when nothing the row reserved survives,
// else which part went — same shape as the collapsed-mode note beside it.
// Subfeature labels are their own radio, so their drop is excluded here and
// surfaced only in the track-sizing note above.
export function labelsFitHint(drops: FitDrops) {
  if (drops.everyLabel) {
    return 'hidden to fit'
  }
  const hidden = hiddenKinds({ ...drops, subfeatureLabels: false })
  return hidden ? `${hidden} hidden to fit` : undefined
}
