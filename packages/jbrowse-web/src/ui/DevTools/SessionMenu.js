import { readConfObject } from '@gmod/jbrowse-core/configuration'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { PropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

function SessionMenu({ session }) {
  const [anchorEl, setAnchorEl] = useState(null)

  const rootConfig = getRoot(session).jbrowse.configuration

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

  return (
    <>
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

      <Button aria-haspopup="true" onClick={handleSessionMenuClick}>
        Session
        <Icon>more_vert</Icon>
      </Button>
    </>
  )
}
SessionMenu.propTypes = {
  session: PropTypes.observableObject.isRequired,
}

export default SessionMenu
