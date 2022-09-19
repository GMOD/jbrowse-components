import React, { useState } from 'react'
import {
  IconButton,
  ListItem,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import DeleteIcon from '@mui/icons-material/Delete'
import MoreVertIcon from '@mui/icons-material/MoreVert'

const useStyles = makeStyles()({
  menu: {
    left: '65%',
  },
})

function RecentSessionCard({ sessionName, onClick, onDelete }) {
  const { classes } = useStyles()
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
      <ListItem onClick={() => onClick(sessionName)} button>
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

export default RecentSessionCard
