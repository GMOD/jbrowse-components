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
    groups,
    groupBy,
  } = model
  return (
    <div data-testid={`display-${getConf(model, 'displayId')}`}>
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
        PileupDisplays.map((disp, index) => {
          const { layoutHeight: height } = disp
          const tag = `${groupBy?.tag}${groups[index] || ' none'}`
          return (
            <div
              data-testid={`Blockset-pileup-${tag}`}
              key={disp.id}
              style={{
                height,
                overflow: 'hidden',
                marginBottom: 5,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  zIndex: 1000,
                  background: 'white',
                  border: '1px solid black',
                }}
              >
                {tag}
              </div>
              {showPileup ? <disp.RenderingComponent model={disp} /> : null}
            </div>
          )
        })
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
