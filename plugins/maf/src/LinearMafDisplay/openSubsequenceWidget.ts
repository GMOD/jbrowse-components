import { isSessionModelWithWidgets } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'

import type { MafSource } from '../types.ts'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The genomic span a drag selection covers, always ordered and inside the
 * region its left edge landed in. A reversed region runs bp leftward, and a
 * drag across a region boundary reads the right edge in another region's
 * coordinates; either inverts the span, and `processFeaturesToFasta` throws a
 * `RangeError` on a negative length.
 *
 * Uses `basePaintedAt`, not `coord0`: `coord0` names the base to the right of
 * the pixel on a reversed region, and this indexes per-base data.
 */
export function selectionRegion(left: PxToBpResult, right: PxToBpResult) {
  // Clamped into the left edge's region, which also covers an out-of-bounds
  // pixel.
  const clamp = (bp: number) =>
    Math.min(Math.max(bp, left.start), Math.max(left.start, left.end - 1))
  const a = clamp(basePaintedAt(left, left.offset))
  const b = clamp(
    right.index === left.index
      ? basePaintedAt(right, right.offset)
      : // Another region: clip to this one's far edge rather than mixing two
        // chromosomes' coordinates. Reversed, "far" is the region start.
        left.reversed
        ? left.start
        : left.end - 1,
  )
  return {
    refName: left.refName,
    start: Math.min(a, b),
    end: Math.max(a, b) + 1,
    assemblyName: left.assemblyName,
  }
}

export interface SubsequenceHost {
  adapterConfig: Record<string, unknown>
  resolvedByteLimit: () => number | undefined
}

/**
 * Open the MAF sequence widget for the genomic range under a drag selection,
 * resolved from `view.pxToBp` at the selection's left pixel. A drag across
 * regions clips to that region (`selectionRegion`).
 */
export function openSubsequenceWidget(
  session: IStateTreeNode,
  // The two things the widget takes off the display, so the track menu's
  // visible-region entry can pass its own model.
  model: SubsequenceHost,
  view: LinearGenomeViewModel,
  startPx: number,
  endPx: number,
  samples: MafSource[],
) {
  if (!isSessionModelWithWidgets(session) || samples.length === 0) {
    return
  }
  session.openWidget('MafSequenceWidget', 'mafSequence', {
    adapterConfig: model.adapterConfig,
    // The display's own budget, captured because the widget has no display to
    // ask. Undefined means "measure nothing" to the worker, so a force-loaded
    // track's widget loads too.
    byteLimit: model.resolvedByteLimit(),
    samples,
    regions: [
      selectionRegion(
        view.pxToBp(Math.min(startPx, endPx)),
        view.pxToBp(Math.max(startPx, endPx)),
      ),
    ],
    connectedViewId: view.id,
  })
}
