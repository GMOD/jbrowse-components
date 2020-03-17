import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useState, useEffect, useRef } from 'react'
import { YScaleBar } from '@gmod/jbrowse-plugin-wiggle/src/WiggleTrack/components/WiggleTrackComponent'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import { useTheme } from '@material-ui/core/styles'
import NestedMenuItem from '@gmod/jbrowse-core/ui/NestedMenuItem'
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
    menuOptions,
    subMenuOptions,
    showPileup,
    showCoverage,
    sortedBy,
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
    setState(() => ({
      mouseX: e.clientX - 2,
      mouseY: e.clientY - 4,
    }))
  }
  const ref = useRef()
  const zIndex = useTheme().zIndex.tooltip // zIndex matches tooltip zindex to bring to front

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
        keepMounted
        open={state.mouseY !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          state.mouseY !== null && state.mouseX !== null
            ? { top: state.mouseY, left: state.mouseX }
            : undefined
        }
        style={{ zIndex }}
      >
        {menuOptions.map(option => {
          return (
            <MenuItem
              key={option.key}
              onClick={() => {
                option.callback()
                handleClose()
              }}
              disabled={option.disableCondition || false}
            >
              {option.icon ? (
                <ListItemIcon key={option.key} style={{ minWidth: '30px' }}>
                  <Icon color="primary" fontSize="small">
                    {option.icon}
                  </Icon>
                </ListItemIcon>
              ) : null}

              {option.title}
            </MenuItem>
          )
        })}
        <NestedMenuItem
          {...props}
          label="Sort by"
          parentMenuOpen={state !== initialState}
          zIndex={zIndex}
          tabIndex={-1}
        >
          {subMenuOptions.map(option => {
            return (
              <MenuItem
                key={option.key}
                style={{
                  backgroundColor:
                    sortedBy !== '' &&
                    sortedBy === option.key &&
                    'darkseagreen',
                }}
                onClick={() => {
                  model.sortSelected(option.key)
                  handleClose()
                }}
              >
                {option.title}
              </MenuItem>
            )
          })}
        </NestedMenuItem>
      </Menu>
    </div>
  )
}

AlignmentsTrackComponent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(AlignmentsTrackComponent)
