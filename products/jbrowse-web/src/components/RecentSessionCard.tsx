import React from 'react'

import { ListItem, ListItemButton, Typography } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'

import type { WebRootModel } from '../rootModel/rootModel'
import type { SavedSession } from '../types'

function RecentSessionCard({
  rootModel,
  sessionSnap,
  onError,
}: {
  rootModel: WebRootModel
  sessionSnap: SavedSession
  onError: (arg: unknown) => void
}) {
  return (
    <ListItem>
      <ListItemButton
        onClick={() => {
          try {
            rootModel.setSession(sessionSnap.session)
          } catch (e) {
            console.error(e)
            onError(e)
          }
        }}
      >
        <Typography variant="body2" noWrap>
          {sessionSnap.session.name} (
          {formatDistanceToNow(sessionSnap.createdAt, { addSuffix: true })})
        </Typography>
      </ListItemButton>
    </ListItem>
  )
}

export default RecentSessionCard
