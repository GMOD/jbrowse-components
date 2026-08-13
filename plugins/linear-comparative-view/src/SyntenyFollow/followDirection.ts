/**
 * Which of a level's two panels moves, which axis the anchor's window is read
 * off, and how far out from the anchor the level sits.
 *
 * An alignment only says anything about the pair it is drawn between, so a
 * follow propagates outward one level at a time rather than mapping distant
 * rows onto the anchor directly. `distance` is the order a pass has to visit
 * them in for that to work, and it is NOT level order: anchor the bottom row of
 * a three-row stack and level 0 comes first while its staying row is the one
 * level 1 has yet to place.
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
