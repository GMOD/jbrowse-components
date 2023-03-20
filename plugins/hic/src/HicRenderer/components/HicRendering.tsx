import React from 'react'
import { Region } from '@jbrowse/core/util/types'
import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

export default observer(function HicRendering(props: {
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
    <div style={{ position: 'relative', width: canvasWidth, height }}>
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
    </div>
  )
})
