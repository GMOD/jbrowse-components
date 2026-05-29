import { useEffect, useMemo, useRef } from 'react'

import { getPreparedCanvas2D } from '@jbrowse/core/gpu/canvas2dUtils'
import { ErrorBar } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { Alert, useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'

import LoadingOverlay from './LoadingOverlay.tsx'
import { buildTextColors, drawSequenceBlocks } from './drawSequence.ts'
import { buildColorPalette } from './sequenceGeometry.ts'

import type { LinearReferenceSequenceDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const SequenceDisplayComponent = observer(function SequenceDisplayComponent({
  model,
}: {
  model: LinearReferenceSequenceDisplayModel
}) {
  const { height, error, showLoading, zoomedOut } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const theme = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const palette = useMemo(() => buildColorPalette(theme), [theme])
  const textColors = useMemo(
    () => buildTextColors(palette, theme),
    [palette, theme],
  )

  useEffect(() => {
    return autorun(function sequenceDrawAutorun() {
      if (model.sequenceData.size > 0) {
        const cssWidth = view.trackWidthPx
        const cssHeight = model.height
        const ctx = getPreparedCanvas2D(canvasRef.current, cssWidth, cssHeight)
        if (ctx) {
          ctx.fillStyle = '#fff'
          ctx.fillRect(0, 0, cssWidth, cssHeight)

          drawSequenceBlocks(ctx, model.sequenceData, model.renderBlocks, {
            bpPerPx: view.bpPerPx,
            showForward: model.showForward,
            showReverse: model.effectiveShowReverse,
            showTranslation: model.effectiveShowTranslation,
            sequenceType: model.sequenceType,
            rowHeight: model.rowHeight,
            palette,
            textColors,
            canvasWidth: cssWidth,
            canvasHeight: cssHeight,
          })
        }
      }
    })
  }, [model, view, palette, textColors])

  return (
    <div
      data-testid="sequence-display"
      style={{ position: 'relative', width: '100%', height }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: zoomedOut || showLoading ? 'none' : 'block',
        }}
      />
      {zoomedOut ? (
        <Alert severity="info">Zoom in to see sequence</Alert>
      ) : (
        <LoadingOverlay isVisible={showLoading} />
      )}
      {error ? (
        <ErrorBar
          error={error}
          onRetry={() => {
            model.clearAllRpcData()
          }}
        />
      ) : null}
    </div>
  )
})

export default SequenceDisplayComponent
