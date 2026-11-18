import { useState } from 'react'

import { formatSessionSummary, sessionLastUsed } from '@jbrowse/app-core'
import VirtualTable, { EditableTextCell } from '@jbrowse/core/ui/VirtualTable'
import { compareValues } from '@jbrowse/core/util/tableText'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { THUMBNAIL_WIDTH } from '../../sessionThumbnail.ts'
import DeleteOldSessionsDialog from './DeleteOldSessionsDialog.tsx'
import { DeleteCell, FavoriteCell, NameCell, ThumbnailCell } from './cells.tsx'

import type { Row } from './cells.tsx'
import type { SessionModel } from './util.ts'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

const useStyles = makeStyles()(theme => ({
  // the widget fills its drawer and the table takes what is left below the
  // controls, scrolling its own rows
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  table: {
    flex: 1,
    // a flex child defaults to min-height:auto, which refuses to shrink below
    // its content and would push the table past the drawer instead of
    // scrolling
    minHeight: 0,
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  mb: {
    margin: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
}))

const ROW_HEIGHT = 72

/**
 * The rows of the table: the saved-session metadata the root model read out
 * of IndexedDB, in display shape, favorites first and each group by last use.
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

const SessionManager = observer(function SessionManager({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  const [deleteOldOpen, setDeleteOldOpen] = useState(false)
  const [sortField, setSortField] = useState('')
  const [sortAscending, setSortAscending] = useState(true)
  const rows = buildRows(session)
  const direction = sortAscending ? 1 : -1
  const sortedRows =
    rows && sortField === 'name'
      ? rows.toSorted((a, b) => compareValues(a.name, b.name, direction))
      : rows

  const columns: VirtualTableColumn<Row>[] = [
    {
      id: 'name',
      header: 'Name',
      fill: true,
      cell: row => (
        <div className={classes.nameCell}>
          <div className={classes.name}>
            <EditableTextCell
              value={row.name}
              label={`Rename ${row.name}`}
              onCommit={text => {
                const name = text.trim()
                if (name !== row.name) {
                  void session.renameSavedSession(row.id, name)
                }
              }}
            >
              <NameCell row={row} session={session} />
            </EditableTextCell>
          </div>
          <FavoriteCell row={row} session={session} />
          <DeleteCell row={row} session={session} />
        </div>
      ),
    },
  ]

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
      {sortedRows ? (
        <div className={classes.table}>
          <VirtualTable
            rows={sortedRows}
            columns={columns}
            widths={() => ({})}
            rowHeight={ROW_HEIGHT}
            leading={{
              width: THUMBNAIL_WIDTH + 16,
              header: null,
              cell: row => <ThumbnailCell row={row} session={session} />,
            }}
            sortField={sortField}
            sortAscending={sortAscending}
            onSort={(field, ascending) => {
              setSortField(field)
              setSortAscending(ascending)
            }}
            resetKey={JSON.stringify([sortField, sortAscending])}
            emptyMessage="No saved sessions"
            testId="session-manager-table"
          />
        </div>
      ) : (
        // undefined, not empty: the saved-session database has not finished
        // opening. An empty list renders the table with its own "no saved
        // sessions" row.
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
