import { useEffect, useMemo } from 'react'

import { DisplayChrome } from '@jbrowse/plugin-linear-genome-view'
import { Alert, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { SequenceRenderer } from './Canvas2DSequenceRenderer.ts'
import { buildTextColors } from './drawSequence.ts'
import { buildColorPalette } from './sequenceGeometry.ts'

import type { LinearReferenceSequenceDisplayModel } from '../model.ts'

const SequenceBody = observer(function SequenceBody({
  model,
  canvasRef,
}: {
  model: LinearReferenceSequenceDisplayModel
  canvasRef: (node: HTMLCanvasElement | null) => void
}) {
  return model.zoomedOut ? (
    <Alert severity="info">Zoom in to see sequence</Alert>
  ) : (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
})

const SequenceDisplayComponent = observer(function SequenceDisplayComponent({
  model,
}: {
  model: LinearReferenceSequenceDisplayModel
}) {
  const { height } = model
  const theme = useTheme()
  const palette = useMemo(() => buildColorPalette(theme), [theme])
  const textColors = useMemo(
    () => buildTextColors(palette, theme),
    [palette, theme],
  )
  useEffect(() => {
    model.setColorState(palette, textColors)
  }, [model, palette, textColors])

  return (
    <DisplayChrome
      model={model}
      factory={SequenceRenderer}
      testid="sequence-display"
      style={{ width: '100%', height }}
    >
      {({ canvasRef }) => <SequenceBody model={model} canvasRef={canvasRef} />}
    </DisplayChrome>
  )
})

export default SequenceDisplayComponent
