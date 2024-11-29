import React, { lazy } from 'react'

import DeleteIcon from '@mui/icons-material/Delete'
import {
  IconButton,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { observer } from 'mobx-react'

import type { SessionSnap } from './util'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// lazies
const DeleteSavedSessionDialog = lazy(
  () => import('./DeleteSavedSessionDialog'),
)

const SessionListItem = observer(function ({
  session,
  snap,
  onClick,
}: {
  snap: SessionSnap
  session: AbstractSessionModel
  onClick: () => void
}) {
  const { createdAt } = snap
  return (
    <ListItem
      secondaryAction={
        <IconButton
          edge="end"
          disabled={session.name === snap.session.name}
          onClick={() => {
            session.queueDialog(handleClose => [
              DeleteSavedSessionDialog,
              {
                session,
                handleClose,
                snap: snap.session,
              },
            ])
          }}
        >
          <DeleteIcon />
        </IconButton>
      }
    >
      <ListItemButton onClick={onClick}>
        <ListItemText
          primary={snap.session.name}
          secondary={
            session.id === snap.session.id
              ? 'Currently open'
              : formatDistanceToNow(createdAt, { addSuffix: true })
          }
        />
      </ListItemButton>
    </ListItem>
  )
})

export default SessionListItem
