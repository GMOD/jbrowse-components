import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useState, useEffect, useRef } from 'react'
import { YScaleBar } from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/components/WiggleTrackComponent'
import { Menu } from '@gmod/jbrowse-core/ui'
import { useTheme } from '@material-ui/core/styles'
import AlignmentsBlockBasedTrack from './AlignmentsBlockBasedTrack'

// import ContextMenu from '@gmod/jbrowse-core/ui/ContextMenu'

const initialState = {
  mouseX: null,
  mouseY: null,
}

function AlignmentsTrackComponent(props) {
  const { model } = props
  const {
    PileupTrack,
    SNPCoverageTrack,
    height,
    showPileup,
    showCoverage,
  } = model

  let showScalebar = false
  if (SNPCoverageTrack) {
    const { ready, stats, needsScalebar } = SNPCoverageTrack
    if (ready && stats && needsScalebar) showScalebar = true
  }

  // Set up context menu
  const [state, setState] = useState(initialState)
  const handleRightClick = e => {
    e.preventDefault()
    setState({
      mouseX: e.clientX - 2,
      mouseY: e.clientY - 4,
    })
  }
  const ref = useRef()
  const zIndex = useTheme().zIndex.tooltip // zIndex matches tooltip zindex to bring to front

  const handleMenuItemClick = (
    event,
    callback, // : () => void,
  ) => {
    callback()
    handleClose()
  }

  const handleClose = () => {
    setState(initialState)
  }

  // determine height of the model when toggling pileuptrack
  useEffect(() => {
    SNPCoverageTrack.setHeight(!showPileup ? model.height : 40)
  }, [SNPCoverageTrack, model, showPileup])

  return (
    <div
      onContextMenu={handleRightClick}
      style={{ position: 'relative', height, width: '100%' }}
      ref={ref}
    >
      <AlignmentsBlockBasedTrack
        {...props}
        {...PileupTrack}
        {...SNPCoverageTrack}
        showPileup={showPileup}
        showSNPCoverage={showCoverage}
      >
        {showScalebar && showCoverage ? (
          <YScaleBar model={SNPCoverageTrack} />
        ) : null}
      </AlignmentsBlockBasedTrack>
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
        menuOptions={model.menuOptions}
      />
    </div>
  )
}

AlignmentsTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackComponent)
