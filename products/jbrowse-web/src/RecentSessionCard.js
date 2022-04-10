import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { makeStyles } from '@mui/material/styles'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DeleteIcon from '@mui/icons-material/Delete'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { ListItem } from '@mui/material'

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
