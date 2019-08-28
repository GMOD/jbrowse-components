import IconButton from '@material-ui/core/IconButton'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import ListItemText from '@material-ui/core/ListItemText'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import MenuIcon from '@material-ui/icons/Menu'
import ViewListIcon from '@material-ui/icons/ViewList'
import PropTypes from 'prop-types'
import React from 'react'

export default function TrackAction({ onTrackSelClick }) {
  const [anchorEl, setAnchorEl] = React.useState(null)

  function handleClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
  }

  return (
    <div>
      <IconButton
        edge="start"
        aria-label="settings"
        color="inherit"
        onClick={handleClick}
      >
        <MenuIcon />
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
            onTrackSelClick()
          }}
        >
          <ListItemIcon>
            <ViewListIcon />
          </ListItemIcon>
          <ListItemText primary="Track Selector" />
        </MenuItem>
      </Menu>
    </div>
  )
}

TrackAction.propTypes = { onTrackSelClick: PropTypes.func.isRequired }
