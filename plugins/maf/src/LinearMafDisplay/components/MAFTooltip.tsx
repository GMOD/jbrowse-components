import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { observer } from 'mobx-react'

import MafAlignmentTooltipContents from './MafAlignmentTooltipContents.tsx'
import MafCoverageTooltipContents from './MafCoverageTooltipContents.tsx'
import MafInterbaseTooltipContents from './MafInterbaseTooltipContents.tsx'
import { findSummaryBarAt } from './computeVisibleSummaryBars.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { MafPointerHit } from './mafHitTest.ts'
import type { MouseState } from '@jbrowse/core/ui'

const MAFTooltip = observer(function MAFTooltip({
  model,
  hit,
  mouseState,
  origMouseX,
}: {
  /** the cursor already projected + hit-tested by the display body */
  hit: MafPointerHit
  /**
   * The chrome's measured pointer, **required**: an omitted `clientPoint` puts
   * floating-ui into pointer-tracking mode, which allocates a virtual reference
   * on every window mousemove (ADR-028). This used to arrive as optional
   * `clientX`/`clientY`, so the expensive mode was one missing prop away and
   * nothing said so at the call site. The body only renders this with a
   * pointer, so there is no absent case to model.
   */
  mouseState: MouseState
  model: LinearMafDisplayModel
  origMouseX?: number
}) {
  const { coverageBandActive, coverageDisplayHeight } = model
  const clientPoint = { x: mouseState.clientX, y: mouseState.clientY }
  const mouseY = mouseState.y
  const view = model.view
  const p1 = origMouseX !== undefined ? view.pxToBp(origMouseX) : undefined
  const { pos: p2, gposFrac, baseBp, rowIndex, inBands, onRow, hover } = hit

  // Over the band area above the rows (coverage and/or conservation). Both show
  // the depth + SNP + identity breakdown via the shared alignments-core tooltip
  // bin (which carries identity). `index` from pxToBp is the displayedRegion
  // index and matches the rpcDataMap key.
  if (inBands) {
    // Insertions (interbase) get their own tooltip, tested first by pixel
    // proximity to the thin boundary bar, but only within the coverage band
    // (that's where the markers draw); otherwise the depth/SNP/identity tooltip
    // for the containing cell. Kept separate so insertion data never mixes into
    // the depth table, mirroring plugin-alignments.
    const insertion =
      coverageBandActive && mouseY < coverageDisplayHeight && !p2.oob
        ? model.coverageInsertionHit(p2.index, gposFrac, view.bpPerPx)
        : undefined
    if (insertion) {
      return (
        <BaseTooltip clientPoint={clientPoint}>
          <MafInterbaseTooltipContents hit={insertion} refName={p2.refName} />
        </BaseTooltip>
      )
    }
    const bin = p2.oob
      ? undefined
      : // the bin is per-base, so it needs the base drawn under the cursor,
        // which coord0 is not on a reversed region (see basePaintedAt)
        model.coverageTooltipBin(
          p2.index,
          basePaintedAt(p2, p2.offset),
          view.bpPerPx,
          p2.reversed,
        )
    return bin ? (
      <BaseTooltip clientPoint={clientPoint}>
        <MafCoverageTooltipContents bin={bin} refName={p2.refName} />
      </BaseTooltip>
    ) : null
  }

  // `hover` (the cell) came resolved with the pointer; `onRow` is false during a
  // selection drag, so the drag's range readout stays. `frame` is the CDS gene at
  // this row, so gene structure is identifiable by hovering any species rather
  // than only the colored strip; `codon` is the actual codon/amino-acid change in
  // codon view, so a specific change reads directly instead of being inferred
  // from color.
  // `baseBp`, not a floored `gposFrac`: both index per-base data, so they want
  // the base painted under the pixel — the same one the coverage tooltip above
  // reads through `basePaintedAt`, which on a reversed region is a different
  // base. See `HoverBp`.
  const frame = onRow
    ? model.frameHoverInfo(p2.index, baseBp, rowIndex)
    : undefined
  const codon = onRow
    ? model.codonHoverInfo(p2.index, baseBp, rowIndex)
    : undefined
  // The zoom-out tier resolves nothing above: `hover` and `codon` both read
  // `rpcDataMap`, which the summary fetch clears. Hit-test the bars the overlay
  // drew instead, so a summary row is identifiable by pointing at it — which is
  // the only way to identify one, since the sidebar labels are the first thing
  // to go as the row height falls.
  const summary = onRow
    ? findSummaryBarAt(model.visibleSummaryBars, rowIndex, mouseState.x)
    : undefined

  return (
    <BaseTooltip clientPoint={clientPoint}>
      <MafAlignmentTooltipContents
        p1={p1}
        p2={p2}
        hover={hover}
        frame={frame}
        codon={codon}
        summary={summary}
        summarySampleLabel={model.samples[rowIndex]?.label}
      />
    </BaseTooltip>
  )
})

export default MAFTooltip
