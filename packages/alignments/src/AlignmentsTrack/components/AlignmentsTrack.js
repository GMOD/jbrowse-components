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

const sortChoices = [
  'Start Location',
  'Read Strand',
  'First-of-pair strand',
  'Base',
]

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
    showCenterLine: false,
  })
  const [sortedBy, setSortedBy] = useState('')

  const generateToggledMenuItems = (
    optionName,
    optionText,
    disableCondition = false,
  ) => {
    return (
      <MenuItem
        name={optionName}
        onClick={handleTrackToggle}
        disabled={disableCondition}
      >
        {displayIcon(optionName)}
        {trackState[optionName] ? `Hide ${optionText}` : `Show ${optionText}`}
      </MenuItem>
    )
  }

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
    setTimeout(() => {
      setTrackState(prevState => ({
        ...trackState,
        [trackSelected]: !prevState[trackSelected],
      }))
    }, 300) // short delay so text changes/disable after menu close
    handleClose()
  }

  const displayIcon = name => {
    return (
      <ListItemIcon style={{ minWidth: '30px' }}>
        <Icon name={name} color="primary" fontSize="small">
          {trackState[name] ? 'visibility_off' : 'visibility'}
        </Icon>
      </ListItemIcon>
    )
  }

  const selectedSortOption = e => {
    const sortOption = e.target.getAttribute('name')
    e.preventDefault()
    setSortedBy(sortOption)
    // sorting code goes here
    switch (sortOption) {
      default:
        handleClose()
    }
    handleClose()
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
        {/* {generateToggledMenuItems(
          'showCoverage',
          SNPCoverageTrack.type,
          !trackState.showPileup,
        )}
        {generateToggledMenuItems(
          'showPileup',
          PileupTrack.type,
          !trackState.showCoverage,
        )}
        {generateToggledMenuItems('showCenterLine', 'Center Line')} */}
        <MenuItem
          name="showCoverage"
          onClick={handleTrackToggle}
          disabled={!trackState.showPileup}
        >
          {displayIcon('showCoverage')}
          {trackState.showCoverage
            ? `Hide ${SNPCoverageTrack.type}`
            : `Show ${SNPCoverageTrack.type}`}
        </MenuItem>
        <MenuItem
          name="showPileup"
          onClick={handleTrackToggle}
          disabled={!trackState.showCoverage}
        >
          {displayIcon('showPileup')}
          {trackState.showPileup
            ? `Hide ${PileupTrack.type}`
            : `Show ${PileupTrack.type}`}
        </MenuItem>
        <MenuItem name="showCenterLine" onClick={handleTrackToggle}>
          {displayIcon('showCenterLine')}
          {trackState.showPileup ? 'Hide Center Line' : 'Show CenterLine'}
        </MenuItem>
        <NestedMenuItem
          {...props}
          label="Sort by"
          parentMenuOpen={state !== initialState}
        >
          {sortChoices.map((name, idx) => (
            <MenuItem
              name={name}
              key={idx}
              style={{ backgroundColor: sortedBy === name && 'darkseagreen' }}
              onClick={selectedSortOption}
            >
              {name}
            </MenuItem>
          ))}
        </NestedMenuItem>
      </Menu>
    </div>
  )
}

AlignmentsTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackComponent)
