import React, { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import ListItem from '@mui/material/ListItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { makeStyles } from 'tss-react/mui'
import DeleteIcon from '@mui/icons-material/Delete'
import MoreVertIcon from '@mui/icons-material/MoreVert'

const useStyles = makeStyles()({
  menu: {
    left: '65%',
  },
})

function RecentSessionCard({
  sessionName,
  onClick,
  onDelete,
}: {
  sessionName: string
  onClick: (arg: string) => void
  onDelete: (arg: string) => void
}) {
  const { classes } = useStyles()
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)

  const handleMenuClose = (action: string) => {
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
        <IconButton
          className={classes.menu}
          onClick={event => {
            event.stopPropagation()
            setMenuAnchorEl(event.currentTarget)
          }}
        >
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
