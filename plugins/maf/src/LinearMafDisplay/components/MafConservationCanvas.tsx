import React, { useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { drawConservation } from './drawConservation.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Draws the conservation (percent identity) band, stacked directly below the
 * coverage band. Mirrors `MafCoverageCanvas`: an `autorun` inside the effect
 * tracks observables (rpcDataMap entries, renderBlocks) so map mutations redraw
 * without `useEffect` deps. Positioned at `top: coverageDisplayHeight` so it
 * sits between the coverage band and the per-sample rows.
 */
const MafConservationCanvas = observer(function MafConservationCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { width } = view
  const { showConservation, conservationHeight, coverageDisplayHeight } = model

  useEffect(() => {
    return autorun(() => {
      const ctx = getPreparedCanvas2D(
        canvasRef.current,
        width,
        conservationHeight,
      )
      if (ctx && showConservation) {
        drawConservation(ctx, model.renderBlocks, model.rpcDataMap, {
          conservationHeight,
          canvasWidth: width,
          theme,
        })
      }
    })
  }, [model, width, conservationHeight, showConservation, theme])

  return showConservation ? (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: coverageDisplayHeight,
        left: 0,
        width,
        height: conservationHeight,
        pointerEvents: 'none',
      }}
    />
  ) : null
})

export default MafConservationCanvas
