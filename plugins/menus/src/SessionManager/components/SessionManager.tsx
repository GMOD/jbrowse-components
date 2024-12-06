import React from 'react'

import { measureGridWidth } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { IconButton, Link } from '@mui/material'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'
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
    <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                <Link
                  onClick={() => {
                    session.activateSession(row.id)
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
          {
            field: 'delete',
            width: 10,
            headerName: '',
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
  )
})

export default SessionManager
