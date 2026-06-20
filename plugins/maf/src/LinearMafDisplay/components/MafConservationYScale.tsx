import React from 'react'

import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

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
        width: 50,
      }}
    >
      <g transform="translate(45, 0)">
        <YScaleBar
          ticks={{
            yTop: 0,
            yBottom: conservationHeight,
            items: [
              { value: 100, y: 0, label: '100%' },
              { value: 50, y: conservationHeight / 2, label: '50%' },
              { value: 0, y: conservationHeight, label: '0%' },
            ],
          }}
          orientation="left"
        />
      </g>
    </svg>
  ) : null
})

export default MafConservationYScale
