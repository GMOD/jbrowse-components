import { readConfObject } from '@gmod/jbrowse-core/configuration'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

const useStyles = makeStyles({
  developer: {
    background: 'white',
    display: 'block',
  },
})

function addView(session, type) {
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
    session.addViewOfDataset(type, readConfObject(session.datasets[0], 'name'))
  }
}

function DeveloperTools({ session }) {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState(null)
  function handleSessionMenuClick(event) {
    setAnchorEl(event.currentTarget)
  }
  function handleSessionMenuClose() {
    setAnchorEl(null)
  }
  function clearSession() {
    localStorage.removeItem('jbrowse-web-data')
    localStorage.removeItem('jbrowse-web-session')
    window.location = window.location.origin
  }
  function toggleUpdateUrl() {
    const updateUrl = readConfObject(rootConfig, 'updateUrl')
    if (updateUrl) window.history.replaceState({}, '', window.location.origin)
    rootConfig.updateUrl.set(!updateUrl)
    handleSessionMenuClose()
  }
  function toggleUseLocalStorage() {
    const useLocalStorage = readConfObject(rootConfig, 'useLocalStorage')
    rootConfig.useLocalStorage.set(!useLocalStorage)
    handleSessionMenuClose()
  }
  const rootConfig = getRoot(session).jbrowse.configuration
  return (
    <div className={classes.developer}>
      <h3>Developer tools</h3>
      <Button
        onClick={() => {
          addView(session, 'LinearGenomeView')
        }}
        variant="outlined"
      >
        Add linear view
      </Button>
      <Button
        onClick={() => {
          addView(session, 'CircularView')
        }}
        variant="outlined"
      >
        Add circular view
      </Button>

      <Button
        disabled={!session.history.canUndo}
        onClick={() => session.history.undo()}
      >
        undo
        <Icon>undo</Icon>
      </Button>
      <Button
        disabled={!session.history.canRedo}
        onClick={() => session.history.redo()}
      >
        <Icon>redo</Icon>
        redo
      </Button>

      <Button aria-haspopup="true" onClick={handleSessionMenuClick}>
        Session
        <Icon>more_vert</Icon>
      </Button>
      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleSessionMenuClose}
      >
        <MenuItem onClick={clearSession}>
          <ListItemIcon>
            <Icon>clear</Icon>
          </ListItemIcon>
          Clear session
        </MenuItem>
        <MenuItem onClick={toggleUpdateUrl}>
          <ListItemIcon>
            <Icon>
              {readConfObject(rootConfig, 'updateUrl')
                ? 'check_box'
                : 'check_box_outline_blank'}
            </Icon>
          </ListItemIcon>
          Update URL
        </MenuItem>
        <MenuItem onClick={toggleUseLocalStorage}>
          <ListItemIcon>
            <Icon>
              {readConfObject(rootConfig, 'useLocalStorage')
                ? 'check_box'
                : 'check_box_outline_blank'}
            </Icon>
          </ListItemIcon>
          Use localStorage
        </MenuItem>
      </Menu>
    </div>
  )
}

DeveloperTools.propTypes = {
  session: PropTypes.observableObject.isRequired,
}

export default observer(DeveloperTools)
