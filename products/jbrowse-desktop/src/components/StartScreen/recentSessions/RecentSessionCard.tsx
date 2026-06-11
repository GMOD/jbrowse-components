import { useState } from 'react'

import { useFetch } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import TextFieldsIcon from '@mui/icons-material/TextFields'
import {
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  CardMedia,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material'

import { defaultSessionScreenshot } from './defaultSessionScreenshot.ts'
import { formatLastModified } from './formatLastModified.ts'

import type { RecentSessionData } from '../types.ts'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()({
  card: {
    width: 250,
    '&:hover': {
      boxShadow: '0px 5px 15px rgba(0,0,0,0.3)',
    },
  },
  media: {
    height: 0,
    paddingTop: '56.25%', // 16:9
  },
  content: {
    paddingBottom: 0,
  },
  actions: {
    justifyContent: 'flex-end',
    paddingTop: 0,
  },
})

function RecentSessionCard({
  sessionData,
  isFavorite,
  onClick,
  onDelete,
  onRename,
  onAddToQuickstartList,
  onToggleFavorite,
}: {
  sessionData: RecentSessionData
  isFavorite: boolean
  onClick: () => void
  onDelete: (arg: RecentSessionData) => void
  onRename: (arg: RecentSessionData) => void
  onAddToQuickstartList: (arg: RecentSessionData) => Promise<void>
  onToggleFavorite: () => void
}) {
  const { classes } = useStyles()
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
  const [now] = useState(() => Date.now())
  const { name, path, updated } = sessionData
  const { label, tooltip } = formatLastModified(updated, now)

  const { data: screenshot } = useFetch(
    ['loadThumbnail', path],
    async () =>
      ((await ipcRenderer.invoke('loadThumbnail', path)) as
        | string
        | undefined) ?? defaultSessionScreenshot,
    {
      onError: e => {
        console.error(e)
      },
    },
  )

  return (
    <>
      <Card className={classes.card}>
        <CardActionArea
          onClick={() => {
            onClick()
          }}
        >
          <CardMedia
            className={classes.media}
            image={screenshot ?? defaultSessionScreenshot}
          />
          <CardContent className={classes.content}>
            <Tooltip title={name} enterDelay={300}>
              <Typography variant="body2" noWrap>
                {name}
              </Typography>
            </Tooltip>
            <Tooltip title={tooltip ?? ''} enterDelay={300}>
              <Typography variant="body2" color="text.secondary" noWrap>
                Last modified {label}
              </Typography>
            </Tooltip>
          </CardContent>
        </CardActionArea>
        <CardActions className={classes.actions}>
          <Tooltip
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <IconButton
              onClick={() => {
                onToggleFavorite()
              }}
              style={{ color: isFavorite ? 'darkorange' : undefined }}
            >
              {isFavorite ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>
          <IconButton
            onClick={event => {
              setMenuAnchorEl(event.currentTarget)
            }}
          >
            <MoreVertIcon />
          </IconButton>
        </CardActions>
      </Card>
      <Menu
        anchorEl={menuAnchorEl}
        keepMounted
        open={Boolean(menuAnchorEl)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClose={() => {
          setMenuAnchorEl(null)
        }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null)
            onToggleFavorite()
          }}
        >
          <ListItemIcon>
            {isFavorite ? <StarIcon /> : <StarBorderIcon />}
          </ListItemIcon>
          <Typography variant="inherit">
            {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null)
            onRename(sessionData)
          }}
        >
          <ListItemIcon>
            <TextFieldsIcon />
          </ListItemIcon>
          <Typography variant="inherit">Rename</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            onDelete(sessionData)
            setMenuAnchorEl(null)
          }}
        >
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <Typography variant="inherit">Delete</Typography>
        </MenuItem>
        <MenuItem
          onClick={async () => {
            await onAddToQuickstartList(sessionData)
            setMenuAnchorEl(null)
          }}
        >
          <ListItemIcon>
            <PlaylistAddIcon />
          </ListItemIcon>
          <Typography variant="inherit">Add to quickstart list</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null)
            ipcRenderer.invoke('showItemInFolder', path).catch(console.error)
          }}
        >
          <ListItemIcon>
            <FolderOpenIcon />
          </ListItemIcon>
          <Typography variant="inherit">Show in folder</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}

export default RecentSessionCard
