import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { drawAlignmentLabels } from './drawAlignmentLabels.ts'

import type { BaseColorState } from '../../features/mismatch/baseColors.ts'
import type { VisibleLabel } from './computeVisibleLabels.ts'

interface VisibleLabelsOverlayProps {
  labels: VisibleLabel[]
  width: number | undefined
  height: number
  baseColors: BaseColorState
}

const VisibleLabelsOverlay = observer(function VisibleLabelsOverlay({
  labels,
  width,
  height,
  baseColors,
}: VisibleLabelsOverlayProps) {
  const palette = usePalette()
  if (labels.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width ?? 0}
      height={height}
      draw={ctx => {
        drawAlignmentLabels(ctx, labels, baseColors, palette)
      }}
    />
  )
})

export default VisibleLabelsOverlay
