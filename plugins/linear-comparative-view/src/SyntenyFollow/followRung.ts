import type { FollowWindow } from './followAnchorWindow.ts'
import type { SpreadDecision } from './spreadDecision.ts'

export type FollowRung =
  | { kind: 'spread' }
  | { kind: 'single'; window: FollowWindow }

/**
 * Which rung places a level, given the anchor's windows and what the last
 * settle decided about spreading. Shared by both clocks so the exact pass and
 * the frame pass cannot disagree about it: several windows spread unless the
 * settle refused, and a refused level is placed from the contig it was refused
 * onto, or from the widest window once the anchor has scrolled off that contig.
 */
export function followRung(
  windows: FollowWindow[],
  decision: SpreadDecision | undefined,
): FollowRung | undefined {
  const widest = windows[0]
  if (!widest) {
    return undefined
  }
  if (windows.length > 1 && decision?.spreading !== false) {
    return { kind: 'spread' }
  }
  return {
    kind: 'single',
    window: windows.find(w => w.refName === decision?.onto) ?? widest,
  }
}
