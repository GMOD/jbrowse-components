import React from 'react'
import { observer } from 'mobx-react'
import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { AlignmentsDisplayModel } from '../models/model'

function AlignmentsDisplay({ model }: { model: AlignmentsDisplayModel }) {
  const { PileupDisplay, SNPCoverageDisplay, showPileup, showCoverage } = model
  return (
    <div
      data-testid={`display-${getConf(model, 'displayId')}`}
      style={{ position: 'relative' }}
    >
      <div data-testid="Blockset-snpcoverage">
        {showCoverage ? (
          <SNPCoverageDisplay.RenderingComponent model={SNPCoverageDisplay} />
        ) : null}
      </div>
      <ResizeHandle
        onDrag={delta => {
          if (SNPCoverageDisplay) {
            SNPCoverageDisplay.setHeight(SNPCoverageDisplay.height + delta)
            return delta
          }
          return 0
        }}
        style={{
          position: 'absolute',
          top: showCoverage ? SNPCoverageDisplay.height + 2 : 0,
          height: 3,
        }}
      />

      <div
        data-testid="Blockset-pileup"
        style={{
          position: 'absolute',
          top: showCoverage ? SNPCoverageDisplay.height + 5 : 0,
          height: 3,
        }}
      >
        {showPileup ? (
          <PileupDisplay.RenderingComponent model={PileupDisplay} />
        ) : null}
      </div>
    </div>
  )
}

export default observer(AlignmentsDisplay)
