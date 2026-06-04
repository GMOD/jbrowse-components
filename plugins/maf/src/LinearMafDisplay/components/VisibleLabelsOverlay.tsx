import { useMemo } from 'react'

import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import OverlayCanvas from './OverlayCanvas.tsx'
import { drawMafLabels } from '../../LinearMafRenderer/rendering/labels.ts'
import { getContrastBaseMap } from '../../LinearMafRenderer/util.ts'

import type { VisibleLabel } from './computeVisibleLabels.ts'

interface Props {
  labels: VisibleLabel[]
  width: number
  height: number
  mismatchRendering: boolean
}

const VisibleLabelsOverlay = observer(function VisibleLabelsOverlay({
  labels,
  width,
  height,
  mismatchRendering,
}: Props) {
  const theme = useTheme()
  const contrastForBase = useMemo(() => getContrastBaseMap(theme), [theme])

  if (labels.length === 0) {
    return null
  }
  return (
    <OverlayCanvas
      width={width}
      height={height}
      draw={ctx => {
        drawMafLabels(ctx, labels, contrastForBase, mismatchRendering)
      }}
    />
  )
})

export default VisibleLabelsOverlay
