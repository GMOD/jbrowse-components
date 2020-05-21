import { observer, PropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useState } from 'react'
import { BlockBasedTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/blockBasedTrackModel'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { ResizeHandle, Menu, MenuOption } from '@gmod/jbrowse-core/ui'
import {
  RenderedBlocks,
  useStyles,
} from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/components/TrackBlocks'

import { useTheme } from '@material-ui/core/styles'

interface AlignmentsBlockBasedTrackStateModel
  extends Instance<BlockBasedTrackStateModel> {
  PileupTrack: Instance<BlockBasedTrackStateModel>
  SNPCoverageTrack: Instance<BlockBasedTrackStateModel>
}

interface MouseState {
  mouseX: number | null
  mouseY: number | null
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

  const initialState = {
    mouseX: null,
    mouseY: null,
  }

  // set up context menu
  const [state, setState] = useState<MouseState>(initialState)
  const [contextMenu, setContextMenu] = useState<MenuOption[]>([])
  const handleRightClick = (
    e: React.MouseEvent,
    trackModel: Instance<BlockBasedTrackStateModel>,
  ) => {
    e.preventDefault()
    if (trackModel.contextMenuOptions.length) {
      setContextMenu(trackModel.contextMenuOptions)
      setState({
        mouseX: e.clientX - 2,
        mouseY: e.clientY - 4,
      })
    }
  }
  const zIndex = useTheme().zIndex.tooltip

  const handleMenuItemClick = (
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    callback: Function,
  ) => {
    callback()
    handleClose()
  }

  const handleClose = () => {
    setState(initialState)
  }

  return (
    <>
      {SNPCoverageTrack && (
        <div
          data-testid="Blockset-snpcoverage"
          className={classes.trackBlocks}
          onContextMenu={e => handleRightClick(e, SNPCoverageTrack)}
          style={{
            left:
              SNPCoverageTrack.blockDefinitions.offsetPx - viewModel.offsetPx,
            display: showSNPCoverage ? 'flex' : 'none',
          }}
        >
          <RenderedBlocks model={SNPCoverageTrack} />
        </div>
      )}
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
      {PileupTrack && (
        <div
          data-testid="Blockset-pileup"
          className={classes.trackBlocks}
          onContextMenu={e => handleRightClick(e, PileupTrack)}
          style={{
            left: PileupTrack.blockDefinitions.offsetPx - viewModel.offsetPx,
            top:
              SNPCoverageTrack && showSNPCoverage
                ? SNPCoverageTrack.height + 5
                : 0,
            display: showPileup ? 'flex' : 'none',
          }}
        >
          <RenderedBlocks model={PileupTrack} />
        </div>
      )}
      <Menu
        open={state.mouseY !== null}
        onMenuItemClick={handleMenuItemClick}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          state.mouseY !== null && state.mouseX !== null
            ? { top: state.mouseY, left: state.mouseX }
            : undefined
        }
        style={{ zIndex }}
        menuOptions={contextMenu}
        data-testid="alignments_context_menu"
      />
    </>
  )
}

AlignmentsTrackBlocks.propTypes = {
  model: PropTypes.observableObject.isRequired,
  viewModel: PropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackBlocks)
