import { readConfObject } from '@gmod/jbrowse-core/configuration'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { PropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

function ViewMenu({ session }) {
  const [anchorEl, setAnchorEl] = useState(null)

  function handleViewMenuClick(event) {
    setAnchorEl(event.currentTarget)
  }
  function handleViewMenuClose() {
    setAnchorEl(null)
  }

  function addView(type) {
    // clone the last view if there is one
    if (session.views.length) {
      session.addViewFromAnotherView(
        type,
        session.views[session.views.length - 1],
      )
    } else {
      // otherwise use the first define dataset
      if (!session.datasets.length)
        throw new Error(`Must add a dataset before adding a view`)
      session.addViewOfDataset(
        type,
        readConfObject(session.datasets[0], 'name'),
      )
    }

    handleViewMenuClose()
  }

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleViewMenuClose}
      >
        <MenuItem
          onClick={() => {
            addView('LinearGenomeView')
          }}
        >
          <ListItemIcon>
            <Icon>calendar_view_day</Icon>
          </ListItemIcon>
          Linear
        </MenuItem>
        <MenuItem
          onClick={() => {
            addView('CircularView')
          }}
        >
          <ListItemIcon>
            <Icon>blur_circular</Icon>
          </ListItemIcon>
          Circular
        </MenuItem>
      </Menu>

      <Button aria-haspopup="true" onClick={handleViewMenuClick}>
        Add View
        <Icon>more_vert</Icon>
      </Button>
    </>
  )
}
ViewMenu.propTypes = {
  session: PropTypes.observableObject.isRequired,
}

export default ViewMenu
