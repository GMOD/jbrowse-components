import { isSessionModelWithWidgets } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'

import type { Sample } from '../types.ts'
import type { LinearMafDisplayModel } from './stateModel.ts'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The genomic span a drag selection covers, always ordered and always inside
 * the region its left edge landed in.
 *
 * Both halves are load-bearing, and both used to be missing — the span was
 * `{ start: left.coord0, end: right.coord }`, which is only ordered on a
 * forward single-region view:
 *
 * - A **reversed** region runs bp leftward, so the left pixel is the *higher*
 *   coordinate and that span came out inverted.
 * - A drag **across a region boundary** reads the right edge in the next
 *   region's coordinates — another chromosome's, and typically much smaller.
 *
 * Either way the widget was handed `end < start`, and the worker's
 * `processFeaturesToFasta` sizes its per-sample row buffers from
 * `region.end - region.start`, so a negative length threw `RangeError: Invalid
 * typed array length` out of the RPC and the widget opened on an error.
 *
 * `basePaintedAt`, not `coord0`: `coord0` is the point-convention inverse of
 * `bpToPx` and on a reversed region names the base to the *right* of the pixel
 * (`r.end` itself on the region's first column). This indexes per-base data, so
 * it wants the base actually under the cursor.
 */
export function selectionRegion(left: PxToBpResult, right: PxToBpResult) {
  // Clamped into the left edge's region, which also covers an out-of-bounds
  // pixel (a drag begun past the last region reports that region with an offset
  // outside it).
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

/**
 * Open the MAF sequence widget for the genomic range under a drag selection.
 * Resolves refName/assemblyName from `view.pxToBp` at the selection's left
 * pixel, so it picks the right region under the cursor on multi-region views
 * (drag selections crossing region boundaries clip to that region — see
 * `selectionRegion`).
 */
export function openSubsequenceWidget(
  session: IStateTreeNode,
  model: LinearMafDisplayModel,
  view: LinearGenomeViewModel,
  startPx: number,
  endPx: number,
  samples: Sample[],
) {
  if (!isSessionModelWithWidgets(session) || samples.length === 0) {
    return
  }
  const widget = session.addWidget('MafSequenceWidget', 'mafSequence', {
    adapterConfig: model.adapterConfig,
    samples,
    regions: [
      selectionRegion(
        view.pxToBp(Math.min(startPx, endPx)),
        view.pxToBp(Math.max(startPx, endPx)),
      ),
    ],
    connectedViewId: view.id,
  })
  session.showWidget(widget)
}
