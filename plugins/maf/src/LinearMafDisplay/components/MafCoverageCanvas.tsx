import React, { useEffect, useRef } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { getPreparedCanvas2D } from '@jbrowse/render-core/canvas2dUtils'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import { drawMafCoverage } from './drawMafCoverage.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Draws the coverage band at the top of the MAF display by delegating to the
 * shared `drawMafCoverage` per-block loop (which wraps alignments-core's
 * `drawCoverageBins` + `drawSnpSegments`). The worker pre-packs both buffers
 * in the same layout alignments uses, so this component does no per-frame
 * data massaging.
 *
 * An `autorun` inside the effect tracks observables (rpcDataMap entries,
 * renderBlocks, coverageDomain) so map mutations re-draw without relying on
 * `useEffect` deps — `observable.map` doesn't change its outer reference.
 */
const MafCoverageCanvas = observer(function MafCoverageCanvas({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { width } = view
  const { showCoverage, coverageHeight } = model

  useEffect(() => {
    return autorun(() => {
      const ctx = getPreparedCanvas2D(canvasRef.current, width, coverageHeight)
      if (ctx && showCoverage) {
        drawMafCoverage(ctx, model.renderBlocks, model.rpcDataMap, {
          coverageHeight,
          canvasWidth: width,
          domainMax: model.coverageDomain?.[1] ?? 0,
          theme,
        })
      }
    })
  }, [model, width, coverageHeight, showCoverage, theme])

  return showCoverage ? (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height: coverageHeight,
        pointerEvents: 'none',
      }}
    />
  ) : null
})

export default MafCoverageCanvas
