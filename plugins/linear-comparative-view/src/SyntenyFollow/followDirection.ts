/**
 * Which of a level's two panels moves when the stack follows synteny, and which
 * axis the anchor's window is read off.
 *
 * A level draws between `views[level]` (the QUERY axis) and `views[level + 1]`
 * (the target axis), and an alignment only says anything about the pair it is
 * drawn between — so a follow propagates outward from the anchor row one level
 * at a time rather than mapping distant rows onto it directly. Levels at or
 * below the anchor carry it downward (the lower panel moves, mapped onto the
 * mate axis); levels above it carry it upward (the upper panel moves, mapped
 * back onto the feature axis).
 *
 * That ordering is what makes a stack of three or more converge: every level's
 * staying panel is either the anchor or a panel some nearer level has already
 * placed, so one pass outward settles the whole stack and no level's move is an
 * input to a level nearer the anchor.
 */
export function followDirection(level: number, anchorIndex: number) {
  return level >= anchorIndex
    ? { stayingIndex: level, movingIndex: level + 1, toMate: true }
    : { stayingIndex: level + 1, movingIndex: level, toMate: false }
}
