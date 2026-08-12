import { useMemo } from 'react'

import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

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
  const palette = usePalette()
  const contrastForBase = useMemo(() => getContrastBaseMap(palette), [palette])

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
