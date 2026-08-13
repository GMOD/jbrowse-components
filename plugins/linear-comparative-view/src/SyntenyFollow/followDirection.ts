/**
 * Which of a level's two panels moves when the stack follows synteny, which
 * axis the anchor's window is read off, and how far out from the anchor the
 * level sits.
 *
 * A level draws between `views[level]` (the QUERY axis) and `views[level + 1]`
 * (the target axis), and an alignment only says anything about the pair it is
 * drawn between — so a follow propagates outward from the anchor row one level
 * at a time rather than mapping distant rows onto it directly. Levels at or
 * below the anchor carry it downward (the lower panel moves, mapped onto the
 * mate axis); levels above it carry it upward (the upper panel moves, mapped
 * back onto the feature axis).
 *
 * `distance` is the order a pass has to visit them in for that to work: every
 * level's staying panel is then either the anchor or a panel some nearer level
 * has already placed, so one pass outward settles the whole stack. Both levels
 * touching the anchor row are distance 0 — the one below it (`level ===
 * anchorIndex`, staying on `views[anchorIndex]`) and the one above (`level ===
 * anchorIndex - 1`, staying on `views[level + 1]`, the same row). LEVEL ORDER
 * IS NOT THIS ORDER: anchor the bottom row of a three-row stack and level 0
 * comes first while its staying row is the one level 1 has yet to place, so
 * every level beyond the first is placed from where its input was a frame ago.
 *
 * One function rather than a direction and a distance, because they are one
 * case split — read the same way twice, they can disagree.
 */
export function followDirection(level: number, anchorIndex: number) {
  return level >= anchorIndex
    ? {
        stayingIndex: level,
        movingIndex: level + 1,
        toMate: true,
        distance: level - anchorIndex,
      }
    : {
        stayingIndex: level + 1,
        movingIndex: level,
        toMate: false,
        distance: anchorIndex - 1 - level,
      }
}
