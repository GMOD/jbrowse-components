/**
 * Which of a level's two panels moves, which axis the anchor's window is read
 * off, and how far out from the anchor the level sits: `distance` is the order
 * a pass visits levels in, outward from the anchor, which is not level order.
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
