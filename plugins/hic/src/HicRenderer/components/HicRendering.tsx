import { Region } from '@gmod/jbrowse-core/util/types'
import { PrerenderedCanvas } from '@gmod/jbrowse-core/ui'
import { observer } from 'mobx-react'
import React from 'react'
import { BlockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/blockBasedTrackModel'

function HicRendering(props: {
  blockKey: string
  trackModel: BlockBasedTrackModel
  width: number
  height: number
  regions: Region[]
  bpPerPx: number
}) {
  const { width, height } = props
  const canvasWidth = Math.ceil(width)
  // need to call this in render so we get the right observer behavior
  return (
    <div
      className="PileupRendering"
      style={{ position: 'relative', width: canvasWidth, height }}
    >
      <PrerenderedCanvas
        {...props}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
    </div>
  )
}

export default observer(HicRendering)
