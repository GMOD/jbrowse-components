import React from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import MafCoverageTooltipContents from './MafCoverageTooltipContents.tsx'
import { generateTooltipContent } from '../util.ts'

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

  // mouseY in [0, coverageDisplayHeight) means cursor is over the coverage
  // band — show depth + SNP breakdown via the shared alignments-core
  // tooltip bin. `index` from pxToBp is the displayedRegion index and
  // matches the rpcDataMap key.
  if (showCoverage && mouseY < coverageDisplayHeight) {
    const bin = p2.oob
      ? undefined
      : model.coverageTooltipBin(p2.index, p2.coord - 1)
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
          p2.coord - 1,
          Math.floor((mouseY + scrollTop - coverageDisplayHeight) / rowHeight),
        )
      : undefined

  return (
    <BaseTooltip clientPoint={clientPoint}>
      <SanitizedHTML html={generateTooltipContent(p1, p2, hover)} />
    </BaseTooltip>
  )
})

export default MAFTooltip
