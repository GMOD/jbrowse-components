import React from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { LinearAlignmentsDisplayModel } from '../model'

const useStyles = makeStyles()({
  resizeHandle: {
    height: 5,
    position: 'absolute',
    zIndex: 2,
  },
})

const AlignmentsDisplay = observer(function AlignmentsDisplay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { PileupDisplay, SNPCoverageDisplay } = model
  const { classes } = useStyles()
  if (!SNPCoverageDisplay) {
    return null
  }
  const top = SNPCoverageDisplay.height ?? 100
  return (
    <div
      data-testid={`display-${getConf(model, 'displayId')}`}
      style={{ position: 'relative' }}
    >
      <div data-testid="Blockset-snpcoverage">
        <SNPCoverageDisplay.RenderingComponent model={SNPCoverageDisplay} />
      </div>
      <ResizeHandle
        onDrag={delta => {
          SNPCoverageDisplay.setHeight(SNPCoverageDisplay.height + delta)
          return delta
        }}
        className={classes.resizeHandle}
        style={{ top: top - 4 }}
      />

      <div
        data-testid="Blockset-pileup"
        style={{
          position: 'absolute',
          top,
        }}
      >
        <PileupDisplay.RenderingComponent model={PileupDisplay} />
      </div>
    </div>
  )
})

export default AlignmentsDisplay
