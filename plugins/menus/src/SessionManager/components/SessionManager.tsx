import React from 'react'

import { measureGridWidth } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { IconButton, Link, Tooltip, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { formatDistanceToNow } from 'date-fns'
import { observer } from 'mobx-react'

import type { SessionModel } from './util'

const SessionManager = observer(function ({
  session,
}: {
  session: SessionModel
}) {
  const rows =
    session.savedSessionMetadata?.map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      fav: r.favorite,
    })) || []
  return (
    <>
      <Typography variant="h6">Recent sessions</Typography>
      <Typography style={{ margin: 20 }}>
        Click the star to "favorite" the session
      </Typography>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <DataGrid
          disableRowSelectionOnClick
          columnHeaderHeight={35}
          rowHeight={25}
          hideFooter={rows.length < 100}
          slotProps={{
            toolbar: {
              showQuickFilter: true,
            },
          }}
          rows={rows}
          columns={[
            {
              field: 'fav',
              headerName: 'Fav',
              width: 20,
              renderCell: ({ row }) => {
                return (
                  <IconButton
                    onClick={() => {
                      if (row.fav) {
                        // @ts-expect-error
                        session.unfavoriteSavedSession(row.id)
                      } else {
                        // @ts-expect-error
                        session.favoriteSavedSession(row.id)
                      }
                    }}
                  >
                    {row.fav ? <StarIcon /> : <StarBorderIcon />}
                  </IconButton>
                )
              },
            },

            {
              field: 'name',
              headerName: 'Name',
              width: measureGridWidth(rows.map(r => r.name)),
              renderCell: ({ row }) => {
                return (
                  <>
                    <Link
                      href="#"
                      onClick={event => {
                        event.preventDefault()
                        session.activateSession(row.id)
                      }}
                    >
                      {row.name}
                    </Link>
                    {session.id === row.id ? ' (current)' : ''}
                  </>
                )
              },
            },
            {
              headerName: 'Created at',
              field: 'createdAt',
              renderCell: ({ row }) => {
                return (
                  <Tooltip
                    disableInteractive
                    slotProps={{
                      transition: {
                        timeout: 0,
                      },
                    }}
                    title={row.createdAt.toLocaleString()}
                  >
                    <div>
                      {formatDistanceToNow(row.createdAt, { addSuffix: true })}
                    </div>
                  </Tooltip>
                )
              },
            },
            {
              field: 'delete',
              width: 10,
              headerName: 'Delete',
              renderCell: ({ row }) => {
                return (
                  <IconButton
                    onClick={() => {
                      // @ts-expect-error
                      session.deleteSavedSession(row.id)
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                )
              },
            },
          ]}
        />
      </div>
    </>
  )
})

export default SessionManager
