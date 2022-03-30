import { Region } from '@jbrowse/core/util/types'
import { PrerenderedCanvas } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import React from 'react'
import { BaseLinearDisplayModel } from '@jbrowse/plugin-linear-genome-view'

function HicRendering(props: {
  blockKey: string;
  displayModel: BaseLinearDisplayModel;
  width: number;
  height: number;
  regions: Region[];
  bpPerPx: number;
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
