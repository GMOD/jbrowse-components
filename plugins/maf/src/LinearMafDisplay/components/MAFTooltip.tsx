import React from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import MafAlignmentTooltipContents from './MafAlignmentTooltipContents.tsx'
import MafCoverageTooltipContents from './MafCoverageTooltipContents.tsx'
import MafInterbaseTooltipContents from './MafInterbaseTooltipContents.tsx'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const MAFTooltip = observer(function ({
  model,
  mouseX,
  mouseY,
  clientX,
  clientY,
  origMouseX,
}: {
  mouseX: number
  mouseY: number
  clientX?: number
  clientY?: number
  model: LinearMafDisplayModel
  origMouseX?: number
}) {
  const {
    showCoverage,
    coverageDisplayHeight,
    rowsTopOffset,
    rowHeight,
    scrollTop,
  } = model
  // Controlled point for floating-ui. Without it, `useClientPoint` enters
  // pointer-tracking mode: a window `mousemove` listener that allocates a fresh
  // virtual reference every move. Every other display tooltip passes this.
  const clientPoint =
    clientX !== undefined && clientY !== undefined
      ? { x: clientX, y: clientY }
      : undefined
  const view = getContainingView(model) as LinearGenomeViewModel
  const p1 = origMouseX !== undefined ? view.pxToBp(origMouseX) : undefined
  const p2 = view.pxToBp(mouseX)
  // Absolute fractional genomic coordinate under the cursor, for px-accurate
  // insertion hit-testing (insertions are interbase). Orientation-aware.
  const gposFrac = p2.reversed ? p2.end - p2.offset : p2.start + p2.offset

  // mouseY in [0, rowsTopOffset) means the cursor is over the band area above
  // the rows (coverage and/or the conservation band). Both show the depth +
  // SNP + identity breakdown via the shared alignments-core tooltip bin (which
  // now carries identity). `index` from pxToBp is the displayedRegion index and
  // matches the rpcDataMap key.
  if (mouseY < rowsTopOffset) {
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
      : model.coverageTooltipBin(p2.index, p2.coord - 1, view.bpPerPx)
    return bin ? (
      <BaseTooltip clientPoint={clientPoint}>
        <MafCoverageTooltipContents bin={bin} refName={p2.refName} />
      </BaseTooltip>
    ) : null
  }

  // Per-row hover: convert (mouseX, mouseY) to (bp, rowIndex into `sources`)
  // and resolve the aligned base or bridged/empty region at that row. Skipped
  // during a selection drag (origMouseX set) so the drag's range readout stays.
  const hover =
    origMouseX === undefined && !p2.oob
      ? model.rowHoverInfo(
          p2.index,
          gposFrac,
          Math.floor((mouseY + scrollTop - rowsTopOffset) / rowHeight),
          view.bpPerPx,
        )
      : undefined

  return (
    <BaseTooltip clientPoint={clientPoint}>
      <MafAlignmentTooltipContents p1={p1} p2={p2} hover={hover} />
    </BaseTooltip>
  )
})

export default MAFTooltip
