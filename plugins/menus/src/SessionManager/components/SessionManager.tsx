import React from 'react'

import { IconButton, Link, Paper } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import DeleteIcon from '@mui/icons-material/Delete'

import type { SessionModel } from './util'
import { measureGridWidth } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  root: {
    margin: theme.spacing(1),
  },
  message: {
    padding: theme.spacing(3),
  },
}))

const SessionManager = observer(function ({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  const rows =
    session.savedSessions?.map(r => ({
      id: r.session.id,
      name: r.session.name,
      createdAt: r.createdAt,
      sessionSnap: r.session,
    })) || []
  return (
    <Paper className={classes.root}>
      <DataGrid
        disableRowSelectionOnClick
        columnHeaderHeight={35}
        rowHeight={25}
        hideFooter={rows.length < 100}
        slots={{
          toolbar: GridToolbar,
        }}
        slotProps={{
          toolbar: {
            showQuickFilter: true,
          },
        }}
        rows={rows}
        columns={[
          {
            field: 'fav',
            headerName: '',
            width: 10,
            renderCell: ({ row }) => {
              const { sessionSnap } = row
              const isFav = session.savedSessions?.includes(sessionSnap.id)
              return (
                <IconButton
                  onClick={() => {
                    if (isFav) {
                      session.unfavoriteSavedSession(sessionSnap.id)
                    } else {
                      session.favoriteSavedSession(sessionSnap.id)
                    }
                  }}
                >
                  {isFav ? <StarIcon /> : <StarBorderIcon />}
                </IconButton>
              )
            },
          },
          {
            field: 'delete',
            width: 10,
            headerName: '',
            renderCell: ({ row }) => {
              const { sessionSnap } = row
              return (
                <IconButton
                  onClick={() => {
                    session.deleteSavedSession(sessionSnap.id)
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              )
            },
          },

          {
            field: 'name',
            headerName: 'Name',
            width: measureGridWidth(rows.map(r => r.name)),
            renderCell: ({ row }) => {
              const { sessionSnap } = row
              return (
                <Link
                  onClick={() => {
                    session.activateSession(sessionSnap.id)
                  }}
                >
                  {row.name}
                </Link>
              )
            },
          },
          {
            headerName: 'Created at',
            field: 'createdAt',
          },
        ]}
      />
    </Paper>
  )
})

export default SessionManager
