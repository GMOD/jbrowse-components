// One arc per refName:start:end. The strand stays out: it is resolved from
// whichever region reported the most reads, so a region loading later can change
// it, and a key that changed with it dropped the selection outline.
export function sashimiArcKey(arc: {
  refName: string
  start: number
  end: number
}) {
  return `${arc.refName}:${arc.start}:${arc.end}`
}

export const SASHIMI_FEATURE_ID_PREFIX = 'sashimi-'

// Scoped by group, so selecting a junction in one sample's section does not
// outline it in every other.
export function sashimiFeatureId(
  groupKey: string,
  arc: { refName: string; start: number; end: number },
) {
  return `${SASHIMI_FEATURE_ID_PREFIX}${groupKey}-${sashimiArcKey(arc)}`
}
