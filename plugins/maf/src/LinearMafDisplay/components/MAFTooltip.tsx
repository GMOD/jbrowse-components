import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { observer } from 'mobx-react'

import MafAlignmentTooltipContents from './MafAlignmentTooltipContents.tsx'
import MafCoverageTooltipContents from './MafCoverageTooltipContents.tsx'
import MafInterbaseTooltipContents from './MafInterbaseTooltipContents.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { MafPointerHit } from './mafHitTest.ts'

const MAFTooltip = observer(function ({
  model,
  hit,
  mouseY,
  clientX,
  clientY,
  origMouseX,
}: {
  /** the cursor already projected + hit-tested by the display body */
  hit: MafPointerHit
  mouseY: number
  clientX?: number
  clientY?: number
  model: LinearMafDisplayModel
  origMouseX?: number
}) {
  const { showCoverage, coverageDisplayHeight } = model
  // Controlled point for floating-ui. Without it, `useClientPoint` enters
  // pointer-tracking mode: a window `mousemove` listener that allocates a fresh
  // virtual reference every move. Every other display tooltip passes this.
  const clientPoint =
    clientX !== undefined && clientY !== undefined
      ? { x: clientX, y: clientY }
      : undefined
  const view = model.lgv
  const p1 = origMouseX !== undefined ? view.pxToBp(origMouseX) : undefined
  const { pos: p2, gposFrac, rowIndex, inBands, onRow, hover } = hit

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
      showCoverage && mouseY < coverageDisplayHeight && !p2.oob
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
      : model.coverageTooltipBin(p2.index, p2.coord0, view.bpPerPx)
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
  const frame = onRow
    ? model.frameHoverInfo(p2.index, gposFrac, rowIndex)
    : undefined
  const codon = onRow
    ? model.codonHoverInfo(p2.index, gposFrac, rowIndex)
    : undefined

  return (
    <BaseTooltip clientPoint={clientPoint}>
      <MafAlignmentTooltipContents
        p1={p1}
        p2={p2}
        hover={hover}
        frame={frame}
        codon={codon}
      />
    </BaseTooltip>
  )
})

export default MAFTooltip
