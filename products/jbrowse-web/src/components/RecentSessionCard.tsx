import React from 'react'

import { ListItem, ListItemButton, Typography } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'

import type { WebRootModel } from '../rootModel/rootModel'
import type { SessionMetadata } from '../types'

function RecentSessionCard({
  rootModel,
  sessionMetadata,
  onError,
}: {
  rootModel: WebRootModel
  sessionMetadata: SessionMetadata
  onError: (arg: unknown) => void
}) {
  return (
    <ListItem>
      <ListItemButton
        onClick={() => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
              await rootModel.activateSession(sessionMetadata.id)
            } catch (e) {
              console.error(e)
              onError(e)
            }
          })()
        }}
      >
        <Typography variant="body2" noWrap>
          {sessionMetadata.name} (
          {formatDistanceToNow(sessionMetadata.createdAt, { addSuffix: true })})
        </Typography>
      </ListItemButton>
    </ListItem>
  )
}

export default RecentSessionCard
