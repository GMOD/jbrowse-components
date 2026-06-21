import React from 'react'

import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import { conservationTicks } from './drawConservation.ts'
import { YSCALE_AXIS_WIDTH, YSCALE_AXIS_X } from './yScaleAxis.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

/**
 * Y-axis for the conservation band: a fixed 0–100% identity scale (the band is
 * always a 0..1 ratio, unlike the coverage band's data-driven depth domain).
 * Positioned at `top: coverageDisplayHeight` so it aligns with the conservation
 * canvas below the coverage band.
 */
const MafConservationYScale = observer(function MafConservationYScale({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { showConservation, conservationHeight, coverageDisplayHeight } = model
  return showConservation ? (
    <svg
      style={{
        position: 'absolute',
        top: coverageDisplayHeight,
        left: 0,
        pointerEvents: 'none',
        height: conservationHeight,
        width: YSCALE_AXIS_WIDTH,
      }}
    >
      <g transform={`translate(${YSCALE_AXIS_X}, 0)`}>
        <YScaleBar
          ticks={conservationTicks(conservationHeight)}
          orientation="left"
        />
      </g>
    </svg>
  ) : null
})

export default MafConservationYScale
