// import { getConf } from '@gmod/jbrowse-core/configuration'
import BlockBasedTrack from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/components/BlockBasedTrack'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { YScaleBar } from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/components/WiggleTrackComponent'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import NestedMenuItem from '@gmod/jbrowse-core/ui/NestedMenuItem'

const initialState = {
  mouseX: null,
  mouseY: null,
}

const sortChoices = ['Option 1', 'Option 2', 'Option 3', 'Option 4']

function AlignmentsTrackComponent(props) {
  const { model } = props
  const { PileupTrack, SNPCoverageTrack, height } = model

  let showScalebar = false
  if (SNPCoverageTrack) {
    const { ready, stats, needsScalebar } = SNPCoverageTrack
    if (ready && stats && needsScalebar) showScalebar = true
  }

  // Set up context menu
  const [state, setState] = useState(initialState)
  const [trackState, setTrackState] = useState({
    showCoverage: true,
    showPileup: true,
  })
  const [sortedBy, setSortedBy] = useState('')

  const handleRightClick = e => {
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
    console.log('clicked', e.target)
    setTimeout(() => {
      setTrackState(prevState => ({
        ...trackState,
        [trackSelected]: !prevState[trackSelected],
      }))
    }, 300) // short delay so text changes/disable after menu close
    handleClose()
  }

  const selectedSortOption = e => {
    e.preventDefault()
    setSortedBy(e.target.getAttribute('name'))
    handleClose()
  }

  const displayIcon = (name) => {
    return (
      <ListItemIcon style={{ minWidth: '30px' }}>
        <Icon name={name} color="primary" fontSize="small">
          {trackState[name] ? 'visibility_off' : 'visibility'}
        </Icon>
      </ListItemIcon>
    )
  }

  const displayActiveSort = sortName => {
    return {
      backgroundColor: sortedBy === sortName ? 'darkseagreen' : '',
    }
  }

  useEffect(() => {
    const newHeight =
      SNPCoverageTrack.height +
      (!trackState.showPileup ? 0 : PileupTrack.height)
    model.setHeight(newHeight)
  }, [
    PileupTrack.height,
    SNPCoverageTrack.height,
    model,
    trackState.showPileup,
  ])

  return (
    <div
      onContextMenu={handleRightClick}
      style={{ position: 'relative', height }}
    >
      <BlockBasedTrack
        {...props}
        {...PileupTrack}
        {...SNPCoverageTrack}
        showPileup={trackState.showPileup}
        showSNPCoverage={trackState.showCoverage}
      >
        {showScalebar && trackState.showCoverage ? (
          <YScaleBar model={SNPCoverageTrack} />
        ) : null}
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
        style={{ zIndex: 10000 }}
      >
        <MenuItem
          name="showCoverage"
          onClick={handleTrackToggle}
          disabled={!trackState.showPileup}
        >
          {displayIcon('showCoverage')}
          {trackState.showCoverage
            ? 'Hide Coverage Track'
            : 'Show Coverage Track'}
        </MenuItem>
        <MenuItem
          name="showPileup"
          onClick={handleTrackToggle}
          disabled={!trackState.showCoverage}
        >
          {displayIcon('showPileup')}
          {trackState.showPileup ? 'Hide Pileup Track' : 'Show Pileup Track'}
        </MenuItem>
        <NestedMenuItem
          {...props}
          label="Sort"
          parentMenuOpen={state !== initialState}
        >
          {sortChoices.map((name, idx) => (
            <MenuItem
              name={name}
              key={idx}
              style={displayActiveSort(name)}
              onClick={selectedSortOption}
            >
              {name}
            </MenuItem>
          ))}
        </NestedMenuItem>
        <MenuItem onClick={handleClose}>Copy</MenuItem>
      </Menu>
    </div>
  )
}

AlignmentsTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackComponent)
