import IconButton from '@material-ui/core/IconButton'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import MoreVertIcon from '@material-ui/icons/MoreVert'
import Settings from '@material-ui/icons/Settings'
import PropTypes from 'prop-types'
import React from 'react'

export default function TrackAction({ onSettingsClick }) {
  const [anchorEl, setAnchorEl] = React.useState(null)

  function handleClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
  }

  return (
    <div>
      <IconButton aria-label="settings" onClick={handleClick}>
        <MoreVertIcon />
      </IconButton>
      <Menu
        id="simple-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem
          onClick={() => {
            handleClose()
            onSettingsClick()
          }}
        >
          <ListItemIcon>
            <Settings />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </MenuItem>
      </Menu>
    </div>
  )
}

TrackAction.propTypes = { onSettingsClick: PropTypes.func.isRequired }
