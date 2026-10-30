import { useState } from 'react'

import { formatSessionSummary } from '@jbrowse/app-core'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { sessionLastUsed } from '@jbrowse/web-core'
import { Button, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import { THUMBNAIL_WIDTH } from '../../sessionThumbnail.ts'
import DeleteOldSessionsDialog from './DeleteOldSessionsDialog.tsx'
import { DeleteCell, FavoriteCell, NameCell, ThumbnailCell } from './cells.tsx'

import type { Row } from './cells.tsx'
import type { SessionModel } from './util.ts'

const useStyles = makeStyles()(theme => ({
  // The widget fills its drawer and the grid takes what is left below the
  // controls. Not cosmetic: MUI's DataGrid draws its horizontal scrollbar as an
  // absolutely positioned overlay at the bottom of its own box, so a grid sized
  // to its content puts that 14px bar *on top of the last row* — and z-index 60
  // wins the hit test, so the bottom session silently stops responding to
  // clicks. Given room, the bar lands below every row.
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  grid: {
    flex: 1,
    // a flex child defaults to min-height:auto, which refuses to shrink below
    // its content and would push the grid past the drawer instead of scrolling
    minHeight: 0,
  },
  mb: {
    margin: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
}))

/**
 * The rows of the grid: the saved-session metadata the root model read out of
 * IndexedDB, in display shape, favorites first and each group by last use.
 * `undefined` in, `undefined` out — that is the "database still opening"
 * state, and it is deliberately not the same value as an empty database (see
 * the render below).
 */
function buildRows(session: SessionModel): Row[] | undefined {
  return session.savedSessionMetadata
    ?.map(r => {
      const current = r.id === session.id
      return {
        id: r.id,
        name: r.name,
        label: current ? `${r.name} (current)` : r.name,
        createdAt: r.createdAt,
        lastUsed: sessionLastUsed(r),
        summary: r.summary && formatSessionSummary(r.summary),
        fav: r.favorite,
        current,
        thumbnail: r.thumbnail,
      }
    })
    .sort((a, b) => +b.fav - +a.fav)
}

/**
 * One entry per column, each deferring to a named cell in cells.tsx so this
 * reads as the shape of the table rather than as four inline components.
 *
 * Name takes the leftover width (`flex`) rather than a width measured from the
 * session names, and the three fixed columns are kept narrow enough that their
 * sum plus Name's minWidth fits a default-width drawer. `measureGridWidth`
 * hands back a *fixed* width — up to 1000px for a long session name — and any
 * total past the panel width grows the horizontal scrollbar this widget's
 * styles exist to keep off the rows (see useStyles).
 */
function buildColumns(session: SessionModel) {
  return [
    {
      field: 'thumbnail',
      headerName: '',
      width: THUMBNAIL_WIDTH + 16,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: ({ row }: { row: Row }) => (
        <ThumbnailCell row={row} session={session} />
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      editable: true,
      flex: 1,
      minWidth: 100,
      renderCell: ({ row }: { row: Row }) => (
        <NameCell row={row} session={session} />
      ),
    },
    {
      field: 'fav',
      headerName: 'Fav',
      // the header of an icon column is short, and its sort arrow and column
      // menu are what push it into an ellipsis
      width: 60,
      disableColumnMenu: true,
      renderCell: ({ row }: { row: Row }) => (
        <FavoriteCell row={row} session={session} />
      ),
    },
    {
      field: 'delete',
      headerName: 'Delete',
      // nothing to sort or filter on a column of buttons, and dropping both
      // gives the header room to say "Delete" instead of "Del..."
      width: 66,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: ({ row }: { row: Row }) => (
        <DeleteCell row={row} session={session} />
      ),
    },
  ]
}

const SessionManager = observer(function SessionManager({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  const [deleteOldOpen, setDeleteOldOpen] = useState(false)
  const rows = buildRows(session)

  return (
    <div className={classes.root}>
      <div className={classes.mb}>
        <Button
          variant="contained"
          disabled={!rows}
          onClick={() => {
            setDeleteOldOpen(true)
          }}
        >
          Delete old sessions...
        </Button>
      </div>
      {rows ? (
        <DataGridFlexContainer className={classes.grid}>
          <DataGrid
            disableRowSelectionOnClick
            columnHeaderHeight={35}
            rowHeight={72}
            hideFooter={rows.length < 100}
            showToolbar
            slotProps={{ toolbar: { showQuickFilter: true } }}
            rows={rows}
            columns={buildColumns(session)}
            processRowUpdate={(newRow: Row, oldRow: Row) => {
              const name = newRow.name.trim()
              if (!name) {
                return oldRow
              }
              if (name !== oldRow.name) {
                void session.renameSavedSession(newRow.id, name)
              }
              return { ...newRow, name }
            }}
            onProcessRowUpdateError={e => {
              console.error(e)
              session.notifyError(`${e}`, e)
            }}
          />
        </DataGridFlexContainer>
      ) : (
        // undefined, not empty: the saved-session database has not finished
        // opening. An empty list renders the grid with its own "no rows" row.
        <Typography className={classes.mb}>
          Loading saved sessions...
        </Typography>
      )}
      {deleteOldOpen ? (
        <DeleteOldSessionsDialog
          session={session}
          onClose={() => {
            setDeleteOldOpen(false)
          }}
        />
      ) : null}
    </div>
  )
})

export default SessionManager
