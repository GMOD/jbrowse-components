import { followWindowsMapping } from './followWindowMapping.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * Rung 3's answer: everything the anchor's visible contigs map to, unioned
 * across every synteny track on the level, since here a track covering another
 * contig widens the answer rather than competing for it.
 *
 * `mapped` is each anchor contig that answered and the contig it answered on:
 * the header names only contigs worth scrolling onto, and handed back as
 * `incumbents` it is the per-window vote's hysteresis.
 */
export function followSpreadSpans({
  displays,
  windows,
  toMate,
  mateAssembly,
  incumbents,
}: {
  displays: LinearSyntenyDisplayModel[]
  windows: FollowWindow[]
  toMate: boolean
  mateAssembly?: string
  incumbents?: ReadonlyMap<string, string>
}) {
  const spans: ResolvedSpan[] = []
  const mapped = new Map<string, string>()
  const incumbentTargets = windows.map(w => incumbents?.get(w.refName))
  for (const display of displays) {
    const data = display.featureData
    if (data) {
      for (const [i, span] of followWindowsMapping({
        data,
        windows,
        toMate,
        mateAssembly,
        incumbentTargets,
      }).entries()) {
        if (span) {
          spans.push(span)
          const { refName } = windows[i]!
          if (!mapped.has(refName)) {
            mapped.set(refName, span.refName)
          }
        }
      }
    }
  }
  return { spans, mapped }
}
