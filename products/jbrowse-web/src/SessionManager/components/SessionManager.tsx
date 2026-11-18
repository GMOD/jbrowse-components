import { useState } from 'react'

import { formatSessionSummary, sessionLastUsed } from '@jbrowse/app-core'
import { SearchField } from '@jbrowse/core/ui/ClearableSearchField'
import ControlRow from '@jbrowse/core/ui/ControlRow'
import VirtualTable from '@jbrowse/core/ui/VirtualTable'
import {
  compareValues,
  searchHighlightPatterns,
  splitSearchWords,
} from '@jbrowse/core/util/tableText'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { THUMBNAIL_WIDTH } from '../../sessionThumbnail.ts'
import DeleteOldSessionsDialog from './DeleteOldSessionsDialog.tsx'
import { SessionRowCell, ThumbnailCell } from './cells.tsx'

import type { Row } from './cells.tsx'
import type { SessionModel } from './util.ts'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  table: {
    flex: 1,
    // a flex child's min-height:auto would push the table past the drawer
    minHeight: 0,
  },
  spacer: {
    flex: 1,
  },
  search: {
    width: 160,
  },
  mb: {
    margin: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
}))

const ROW_HEIGHT = 72

/**
 * The saved sessions, favorites first and each group by last use; `undefined`
 * while the database is still opening, which is not the same as empty.
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
  const [searchText, setSearchText] = useState('')
  const rows = buildRows(session)
  const words = splitSearchWords(searchText)
  const searched = words.length
    ? rows?.filter(row => {
        const name = row.name.toLowerCase()
        return words.every(word => name.includes(word))
      })
    : rows
  const direction = sortAscending ? 1 : -1
  const sortedRows =
    searched && sortField === 'name'
      ? searched.toSorted((a, b) => compareValues(a.name, b.name, direction))
      : searched

  const columns: VirtualTableColumn<Row>[] = [
    {
      id: 'name',
      header: 'Name',
      fill: true,
      cell: row => <SessionRowCell row={row} session={session} />,
    },
  ]

  return (
    <div className={classes.root}>
      <ControlRow className={classes.mb}>
        <Button
          variant="contained"
          disabled={!rows}
          onClick={() => {
            setDeleteOldOpen(true)
          }}
        >
          Delete old sessions...
        </Button>
        <div className={classes.spacer} />
        {rows && sortedRows && sortedRows.length !== rows.length ? (
          <Typography
            variant="caption"
            color="textSecondary"
            noWrap
            role="status"
          >
            {sortedRows.length} of {rows.length}
          </Typography>
        ) : null}
        <SearchField
          quiet
          size="small"
          className={classes.search}
          label="Search"
          value={searchText}
          onChange={setSearchText}
        />
      </ControlRow>
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
            resetKey={JSON.stringify([searchText, sortField, sortAscending])}
            highlightPatterns={searchHighlightPatterns(words)}
            emptyMessage={
              words.length ? 'No matching sessions' : 'No saved sessions'
            }
            testId="session-manager-table"
          />
        </div>
      ) : (
        // undefined, not empty: the database has not finished opening
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
