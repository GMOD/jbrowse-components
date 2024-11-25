import React, { useState } from 'react'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import {
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material'

function RecentSessionCard({
  sessionName,
  onClick,
  onDelete,
}: {
  sessionName: string
  onClick: (arg: string) => void
  onDelete?: (arg: string) => void
}) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)

  return (
    <>
      <ListItem
        secondaryAction={
          <IconButton
            onClick={event => {
              event.stopPropagation()
              setMenuAnchorEl(event.currentTarget)
            }}
          >
            <MoreVertIcon />
          </IconButton>
        }
      >
        <ListItemButton
          onClick={() => {
            onClick(sessionName)
          }}
        >
          <Tooltip title={sessionName} enterDelay={300}>
            <Typography variant="body2" noWrap>
              {sessionName}
            </Typography>
          </Tooltip>
        </ListItemButton>
      </ListItem>
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => {
          setMenuAnchorEl(null)
        }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null)
            onDelete?.(sessionName)
          }}
          disabled={!onDelete}
        >
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <Typography variant="inherit">Delete</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}

export default RecentSessionCard
