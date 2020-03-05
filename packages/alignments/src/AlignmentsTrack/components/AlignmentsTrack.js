// import { getConf } from '@gmod/jbrowse-core/configuration'
import BlockBasedTrack from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/components/BlockBasedTrack'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'
import { YScaleBar } from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/components/WiggleTrackComponent'
import ContextMenu from '@gmod/jbrowse-core/ui/ContextMenu'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'

const initialState = {
  mouseX: null,
  mouseY: null,
}

function AlignmentsTrackComponent(props) {
  const { model } = props
  const { PileupTrack, SNPCoverageTrack, height } = model

  let showScalebar = false
  if (SNPCoverageTrack) {
    const { ready, stats, needsScalebar } = SNPCoverageTrack
    if (ready && stats && needsScalebar) showScalebar = true
  }

  // Set up context menu
  const [state, setState] = React.useState(initialState)
  const [trackState, setTrackState] = React.useState({
    showCoverage: true,
    showPileup: true,
  })

  const handleClick = e => {
    e.preventDefault()
    setState(() => ({
      mouseX: e.clientX - 2,
      mouseY: e.clientY - 4,
    }))
  }

  const handleClose = () => {
    setState(initialState)
  }

  const handleTrackToggle = e => {
    e.preventDefault()
    const trackSelected = e.target.getAttribute('name')
    setTimeout(() => {
      setTrackState(prevState => ({
        ...trackState,
        [trackSelected]: !prevState[trackSelected],
      }))
    }, 300) // short delay so text changes/disable after menu close
    handleClose()
  }

  return (
    // <BlockBasedTrack {...props} {...PileupTrack} {...SNPCoverageTrack}>
    //   {showScalebar ? <YScaleBar model={SNPCoverageTrack} /> : null}
    // </BlockBasedTrack>
    <div onContextMenu={handleClick} style={{ position: 'relative', height }}>
      <BlockBasedTrack {...props} {...PileupTrack} {...SNPCoverageTrack}>
        {showScalebar ? <YScaleBar model={SNPCoverageTrack} /> : null}
      </BlockBasedTrack>
      <Menu
        keepMounted
        open={state.mouseY !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          state.mouseY !== null && state.mouseX !== null
            ? { top: state.mouseY, left: state.mouseX }
            : undefined
        }
      >
        <MenuItem
          name="showCoverage"
          onClick={handleTrackToggle}
          disabled={!trackState.showPileup}
        >
          {trackState.showCoverage
            ? 'Hide Coverage Track'
            : 'Show Coverage Track'}
        </MenuItem>
        <MenuItem
          name="showPileup"
          onClick={handleTrackToggle}
          disabled={!trackState.showCoverage}
        >
          {trackState.showPileup ? 'Hide Pileup Track' : 'Show Pileup Track'}
        </MenuItem>
        <MenuItem onClick={handleClose}>Sort</MenuItem>
        <MenuItem onClick={handleClose}>Copy</MenuItem>
      </Menu>
    </div>
  )
}

AlignmentsTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackComponent)
