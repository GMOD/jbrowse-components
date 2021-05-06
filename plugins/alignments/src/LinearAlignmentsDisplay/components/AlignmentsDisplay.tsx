import React from 'react'
import { observer } from 'mobx-react'
import { getConf } from '@jbrowse/core/configuration'
import { ResizeHandle } from '@jbrowse/core/ui'
import { AlignmentsDisplayModel } from '../models/model'

function AlignmentsDisplay({ model }: { model: AlignmentsDisplayModel }) {
  const {
    PileupDisplay,
    PileupDisplays,
    SNPCoverageDisplay,
    showPileup,
    showCoverage,
  } = model
  return (
    <div
      data-testid={`display-${getConf(model, 'displayId')}`}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <div
        data-testid="Blockset-snpcoverage"
        style={{ height: SNPCoverageDisplay.height }}
      >
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
          height: 3,
        }}
      />

      {PileupDisplays ? (
        PileupDisplays.map(disp => (
          <div
            data-testid="Blockset-pileup"
            key={disp.id}
            style={{ height: 100 }}
          >
            {showPileup ? <disp.RenderingComponent model={disp} /> : null}
          </div>
        ))
      ) : (
        <div data-testid="Blockset-pileup">
          {showPileup ? (
            <PileupDisplay.RenderingComponent model={PileupDisplay} />
          ) : null}
        </div>
      )}
    </div>
  )
}

export default observer(AlignmentsDisplay)
