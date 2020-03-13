import { observer, PropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import { BlockBasedTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/blockBasedTrackModel'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import {
  RenderedBlocks,
  useStyles,
} from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/components/TrackBlocks'

interface AlignmentsBlockBasedTrackStateModel
  extends Instance<BlockBasedTrackStateModel> {
  PileupTrack: Instance<BlockBasedTrackStateModel>
  SNPCoverageTrack: Instance<BlockBasedTrackStateModel>
}

function AlignmentsTrackBlocks({
  model,
  viewModel,
  showPileup,
  showSNPCoverage,
}: {
  model: AlignmentsBlockBasedTrackStateModel
  viewModel: Instance<LinearGenomeViewStateModel>
  showPileup: boolean
  showSNPCoverage: boolean
}) {
  const classes = useStyles()
  const { PileupTrack, SNPCoverageTrack } = model

  return (
    <>
      {/* {SNPCoverageTrack && showSNPCoverage && ( */}
      {SNPCoverageTrack && (
        <div
          data-testid="Blockset"
          className={classes.trackBlocks}
          style={{
            left:
              SNPCoverageTrack.blockDefinitions.offsetPx - viewModel.offsetPx,
            display: showSNPCoverage ? 'flex' : 'none',
          }}
        >
          <RenderedBlocks model={SNPCoverageTrack} />
        </div>
      )}
      {/* {PileupTrack && showPileup && ( */}
      {PileupTrack && (
        <div
          data-testid="Blockset"
          className={classes.trackBlocks}
          style={{
            left: PileupTrack.blockDefinitions.offsetPx - viewModel.offsetPx,
            top:
              SNPCoverageTrack && showSNPCoverage ? SNPCoverageTrack.height : 0,
            display: showPileup ? 'flex' : 'none',
          }}
        >
          <RenderedBlocks model={PileupTrack} />
        </div>
      )}
    </>
  )
}

AlignmentsTrackBlocks.propTypes = {
  model: PropTypes.observableObject.isRequired,
  viewModel: PropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackBlocks)
