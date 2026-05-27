import React from 'react'

import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Y-axis tick overlay for the coverage band. Mirrors the alignments display's
 * CoverageAxisHost — wraps `YScaleBar` from wiggle-core with the model's
 * `coverageTicks` (computed by alignments-core's `computeCoverageTicks`).
 */
const MafCoverageYScale = observer(function MafCoverageYScale({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { coverageTicks, coverageHeight, showCoverage } = model
  return showCoverage && coverageTicks ? (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        height: coverageHeight,
        width: 50,
      }}
    >
      <g transform="translate(45, 0)">
        <YScaleBar ticks={coverageTicks} orientation="left" />
      </g>
    </svg>
  ) : null
})

export default MafCoverageYScale
