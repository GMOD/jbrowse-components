import React, { useEffect } from 'react'
import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { Region } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { LinearVariantMatrixDisplayModel } from '../../LinearVariantMatrixDisplay/model'

export default observer(function LinearVariantMatrixRendering(props: {
  blockKey: string
  displayModel: LinearVariantMatrixDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  onMouseMove?: (event: React.MouseEvent, featureId?: string) => void
  samples: string[]
}) {
  const { displayModel, width, height, samples } = props

  useEffect(() => {
    displayModel.setSamples(samples)
  }, [samples, displayModel])
  const canvasWidth = Math.ceil(width)

  return (
    <div style={{ position: 'relative', width: canvasWidth, height }}>
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
    </div>
  )
})
