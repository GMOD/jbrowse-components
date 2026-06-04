import React from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import MafAlignmentTooltipContents from './MafAlignmentTooltipContents.tsx'
import MafCoverageTooltipContents from './MafCoverageTooltipContents.tsx'
import MafInterbaseTooltipContents from './MafInterbaseTooltipContents.tsx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { LinearMafDisplayModel } from '../stateModel.ts'

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
  const { showCoverage, coverageDisplayHeight, rowHeight, scrollTop } = model
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

  // mouseY in [0, coverageDisplayHeight) means cursor is over the coverage
  // band — show depth + SNP breakdown via the shared alignments-core
  // tooltip bin. `index` from pxToBp is the displayedRegion index and
  // matches the rpcDataMap key.
  if (showCoverage && mouseY < coverageDisplayHeight) {
    // Insertions (interbase) get their own tooltip, tested first by pixel
    // proximity to the thin boundary bar; otherwise the depth/SNP coverage
    // tooltip for the containing cell. Kept separate so insertion data never
    // mixes into the depth table, mirroring plugin-alignments.
    const insertion = p2.oob
      ? undefined
      : model.coverageInsertionHit(p2.index, gposFrac, view.bpPerPx)
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
          Math.floor((mouseY + scrollTop - coverageDisplayHeight) / rowHeight),
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
