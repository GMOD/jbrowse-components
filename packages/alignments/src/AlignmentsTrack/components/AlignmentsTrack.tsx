import { observer } from 'mobx-react'
import React, { useEffect } from 'react'
import { ResizeHandle } from '@gmod/jbrowse-core/ui'
import { AlignmentsTrackModel } from '../model'

function AlignmentsTrackComponent({ model }: { model: AlignmentsTrackModel }) {
  const { PileupTrack, SNPCoverageTrack, showPileup, showCoverage } = model

  // determine height of the model when toggling pileuptrack
  useEffect(() => {
    SNPCoverageTrack.setHeight(!showPileup ? model.height : 40)
  }, [SNPCoverageTrack, model, showPileup])

  return (
    <div style={{ position: 'relative' }}>
      <div data-testid="Blockset-pileup">
        {showCoverage ? (
          <SNPCoverageTrack.ReactComponent model={SNPCoverageTrack} />
        ) : null}
      </div>
      <ResizeHandle
        onDrag={delta => {
          if (SNPCoverageTrack) {
            SNPCoverageTrack.setHeight(SNPCoverageTrack.height + delta)
            return delta
          }
          return 0
        }}
        style={{
          position: 'absolute',
          top: SNPCoverageTrack ? SNPCoverageTrack.height + 2 : 0,
          height: 3,
        }}
      />

      <div
        data-testid="Blockset-snpcoverage"
        style={{
          position: 'absolute',
          top: SNPCoverageTrack ? SNPCoverageTrack.height + 5 : 0,
          height: 3,
        }}
      >
        {showPileup ? <PileupTrack.ReactComponent model={PileupTrack} /> : null}
      </div>
    </div>
  )
}

export default observer(AlignmentsTrackComponent)
