import React, { useEffect, useState } from 'react'

import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'

import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition'

import type { LinearVariantMatrixDisplayModel } from '../../MultiLinearVariantMatrixDisplay/model'
import type { Feature, Region } from '@jbrowse/core/util'

const LinearVariantMatrixRendering = observer(function (props: {
  blockKey: string
  displayModel: LinearVariantMatrixDisplayModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
  simplifiedFeatures: Feature[]
  onMouseMove?: (event: React.MouseEvent, featureId?: string) => void
}) {
  const { simplifiedFeatures, displayModel, width, height } = props
  const [renderLines, setRenderLines] = useState(false)
  useEffect(() => {
    setRenderLines(true)
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: Math.ceil(width),
        height,
      }}
    >
      {renderLines ? (
        isAlive(displayModel) ? (
          <LinesConnectingMatrixToGenomicPosition
            features={simplifiedFeatures}
            model={displayModel}
          />
        ) : null
      ) : null}
      <PrerenderedCanvas
        {...props}
        style={{
          position: 'absolute',
          left: 0,
          top: 20,
        }}
      />
    </div>
  )
})

export default LinearVariantMatrixRendering
