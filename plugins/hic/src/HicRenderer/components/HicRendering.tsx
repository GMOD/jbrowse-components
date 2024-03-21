import React from 'react'
import { Region } from '@jbrowse/core/util/types'
import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

const HicRendering = observer(function HicRendering(props: {
  blockKey: string
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
}) {
  const { width, height } = props
  const canvasWidth = Math.ceil(width)
  // need to call this in render so we get the right observer behavior
  return (
    <div style={{ height, position: 'relative', width: canvasWidth }}>
      <PrerenderedCanvas
        {...props}
        style={{ left: 0, position: 'absolute', top: 0 }}
      />
    </div>
  )
})

export default HicRendering
