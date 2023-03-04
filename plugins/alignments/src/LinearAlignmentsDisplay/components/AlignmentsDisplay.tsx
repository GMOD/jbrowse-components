import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'

// locals
import { AlignmentsDisplayModel } from '../models/model'

const useStyles = makeStyles()({
  resizeHandle: {
    height: 2,
    position: 'absolute',
    zIndex: 2,
  },
})

function AlignmentsDisplay({ model }: { model: AlignmentsDisplayModel }) {
  const { PileupDisplay, SNPCoverageDisplay } = model
  const { classes } = useStyles()
  const top = SNPCoverageDisplay.height
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
        style={{ top }}
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
}

export default observer(AlignmentsDisplay)
