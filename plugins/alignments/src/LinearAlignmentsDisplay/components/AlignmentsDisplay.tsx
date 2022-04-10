import React from 'react'
import { observer } from 'mobx-react'
import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@mui/material'
import { AlignmentsDisplayModel } from '../models/model'

const useStyles = makeStyles(() => ({
  resizeHandle: {
    height: 2,
    position: 'absolute',
    zIndex: 2,
  },
}))

function AlignmentsDisplay({ model }: { model: AlignmentsDisplayModel }) {
  const { PileupDisplay, SNPCoverageDisplay, showPileup, showCoverage } = model
  const classes = useStyles()
  const top = SNPCoverageDisplay.height
  return (
    <div
      data-testid={`display-${getConf(model, 'displayId')}`}
      style={{ position: 'relative' }}
    >
      {showCoverage ? (
        <>
          <div data-testid="Blockset-snpcoverage">
            <SNPCoverageDisplay.RenderingComponent model={SNPCoverageDisplay} />
          </div>
          <ResizeHandle
            onDrag={delta => {
              SNPCoverageDisplay.setHeight(SNPCoverageDisplay.height + delta)
              return delta
            }}
            className={classes.resizeHandle}
            style={{
              top,
            }}
          />
        </>
      ) : null}

      {showPileup ? (
        <div
          data-testid="Blockset-pileup"
          style={{
            position: 'absolute',
            top: showCoverage ? SNPCoverageDisplay.height : 0,
          }}
        >
          <PileupDisplay.RenderingComponent model={PileupDisplay} />
        </div>
      ) : null}
    </div>
  )
}

export default observer(AlignmentsDisplay)
