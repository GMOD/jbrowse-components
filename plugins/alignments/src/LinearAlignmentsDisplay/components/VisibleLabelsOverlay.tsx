import { OverlayCanvas } from '@jbrowse/render-core'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { drawAlignmentLabels } from './drawAlignmentLabels.ts'

import type { VisibleLabel } from './computeVisibleLabels.ts'

interface VisibleLabelsOverlayProps {
  labels: VisibleLabel[]
  width: number | undefined
  height: number
  contrastMap: Record<string, string>
}

const VisibleLabelsOverlay = observer(function VisibleLabelsOverlay({
  labels,
  width,
  height,
  contrastMap,
}: VisibleLabelsOverlayProps) {
  const theme = useTheme()
  if (labels.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width ?? 0}
      height={height}
      draw={ctx => {
        drawAlignmentLabels(ctx, labels, contrastMap, theme)
      }}
    />
  )
})

export default VisibleLabelsOverlay
