import { observer } from 'mobx-react'
import { getConf } from '@jbrowse/core/configuration'
import React, { useEffect } from 'react'
import { ResizeHandle } from '@jbrowse/core/ui'
import { AlignmentsDisplayModel } from '../models/model'

function AlignmentsDisplayComponent({
  model,
}: {
  model: AlignmentsDisplayModel
}) {
  const { PileupDisplay, SNPCoverageDisplay, showPileup, showCoverage } = model

  // determine height of the model when toggling pileupdisplay
  useEffect(() => {
    SNPCoverageDisplay.setHeight(!showPileup ? model.height : 40)
  }, [SNPCoverageDisplay, model, showPileup])

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

export default observer(AlignmentsDisplayComponent)
