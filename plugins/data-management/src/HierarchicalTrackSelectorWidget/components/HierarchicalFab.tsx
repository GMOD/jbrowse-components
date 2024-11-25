import React, { useState } from 'react'
import {
  getSession,
  isSessionModelWithWidgets,
  isSessionModelWithConnections,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import AddIcon from '@mui/icons-material/Add'
import { Fab, Menu, MenuItem } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import type { HierarchicalTrackSelectorModel } from '../model'

const useStyles = makeStyles()(theme => ({
  fab: {
    position: 'absolute',
    bottom: theme.spacing(6),
    right: theme.spacing(6),
  },
}))

const HierarchicalFab = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)

  function handleFabClose() {
    setAnchorEl(null)
  }
  const hasConnections = isSessionModelWithConnections(session)
  const hasAddTrack = isSessionWithAddTracks(session)
  return hasAddTrack || hasConnections ? (
    <>
      <Fab
        color="secondary"
        className={classes.fab}
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
      >
        <AddIcon />
      </Fab>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null)
        }}
      >
        {hasConnections ? (
          <MenuItem
            onClick={() => {
              handleFabClose()
              if (isSessionModelWithWidgets(session)) {
                session.showWidget(
                  session.addWidget(
                    'AddConnectionWidget',
                    'addConnectionWidget',
                  ),
                )
              }
            }}
          >
            Add connection
          </MenuItem>
        ) : null}
        {hasAddTrack ? (
          <MenuItem
            onClick={() => {
              handleFabClose()
              if (isSessionModelWithWidgets(session)) {
                session.showWidget(
                  session.addWidget('AddTrackWidget', 'addTrackWidget', {
                    view: model.view.id,
                  }),
                )
              }
            }}
          >
            Add track
          </MenuItem>
        ) : null}
      </Menu>
    </>
  ) : null
})

export default HierarchicalFab
