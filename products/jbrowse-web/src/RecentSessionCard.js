import IconButton from '@material-ui/core/IconButton'
import ListItemIcon from '@material-ui/core/ListItemIcon'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import DeleteIcon from '@material-ui/icons/Delete'
import MoreVertIcon from '@material-ui/icons/MoreVert'
import { ListItem } from '@material-ui/core'

import PropTypes from 'prop-types'
import React, { useState } from 'react'

const useStyles = makeStyles({
  menu: {
    left: '65%',
  },
})

function RecentSessionCard({ sessionName, onClick, onDelete }) {
  const classes = useStyles()
  const [hovered, setHovered] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState(null)

  function onMenuClick(event) {
    event.stopPropagation()
    setMenuAnchorEl(event.currentTarget)
  }

  const handleMenuClose = action => {
    setMenuAnchorEl(null)
    if (action === 'delete') {
      return onDelete(sessionName)
    }
    return undefined
  }

  return (
    <>
      <ListItem
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
        onClick={() => onClick(sessionName)}
        raised={Boolean(hovered)}
        button
      >
        <Tooltip title={sessionName} enterDelay={300}>
          <Typography variant="body2" noWrap style={{ width: 250 }}>
            {sessionName}
          </Typography>
        </Tooltip>
        <IconButton className={classes.menu} onClick={onMenuClick}>
          <MoreVertIcon color="secondary" />
        </IconButton>
      </ListItem>
      <Menu
        id="simple-menu"
        anchorEl={menuAnchorEl}
        keepMounted
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMenuClose('delete')}>
          <ListItemIcon>
            <DeleteIcon color="secondary" />
          </ListItemIcon>
          <Typography variant="inherit">Delete</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}

RecentSessionCard.propTypes = {
  sessionName: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
}

export default RecentSessionCard
