import { useState } from 'react'

import { CascadingMenuButton } from '@jbrowse/core/ui'
import { useFetch } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import {
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  CardMedia,
  Tooltip,
  Typography,
} from '@mui/material'

import StarIcon from '../StarIcon.tsx'
import { defaultSessionScreenshot } from './defaultSessionScreenshot.ts'
import { formatLastModified } from './formatLastModified.ts'
import { sessionMenuItems } from './sessionMenuItems.ts'

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
  launch,
  onDelete,
  onRename,
  onAddToQuickstartList,
  onToggleFavorite,
}: {
  sessionData: RecentSessionData
  isFavorite: boolean
  launch: (path: string) => Promise<void>
  onDelete: (arg: RecentSessionData) => void
  onRename: (arg: RecentSessionData) => void
  onAddToQuickstartList: (arg: RecentSessionData) => Promise<void>
  onToggleFavorite: () => void
}) {
  const { classes } = useStyles()
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
    <Card className={classes.card}>
      <CardActionArea
        onClick={() => {
          launch(path).catch(console.error)
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
        <StarIcon
          isFavorite={isFavorite}
          size="medium"
          onClick={() => {
            onToggleFavorite()
          }}
        />
        <CascadingMenuButton
          menuItems={sessionMenuItems({
            session: sessionData,
            isFavorite,
            launch,
            onRename,
            onDelete,
            onToggleFavorite,
            onAddToQuickstartList,
          })}
        >
          <MoreVertIcon />
        </CascadingMenuButton>
      </CardActions>
    </Card>
  )
}

export default RecentSessionCard
