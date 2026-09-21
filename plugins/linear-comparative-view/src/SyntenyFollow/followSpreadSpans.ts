import { followWindowsMapping } from './followWindowMapping.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * Everything the anchor's visible contigs map to, across every synteny track on
 * the level — the answer for a row showing more than one contig, as a
 * whole-genome overview does.
 *
 * THE UNION, where the single-contig rung holds a vote. One alignment relates
 * one contig pair, so a window spanning contigs has no single matching region;
 * the reader is looking at a swathe of one genome, and the answer is the swathe
 * of the other it aligns to. `positionViewOnSpans` turns that into one
 * interval of the moving row's own layout.
 *
 * Across DISPLAYS too, rather than the widest-track vote `planFollowStep` runs.
 * That vote exists so a sparse track cannot pull the row off the locus the
 * dense one covers; here there is no locus to be pulled off, and a track that
 * covers a contig the other does not should widen the answer to include it.
 *
 * `mapped` is WHICH ANCHOR CONTIGS ANSWERED, and the contig each answered on —
 * the windows a span came back for. The spans themselves are on the moving row
 * and cannot say, and a refused spread's header offers the reader the anchor
 * contigs worth scrolling onto: built off the windows instead it named contigs
 * with no alignment in the file at all. Handed back as `incumbents`, it is the
 * vote's hysteresis per window, since panning across a fusion breakpoint moves
 * the evidence from one mate contig to the other a frame at a time.
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
