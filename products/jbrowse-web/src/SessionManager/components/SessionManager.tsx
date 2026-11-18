import { useState } from 'react'

import { formatSessionSummary, sessionLastUsed } from '@jbrowse/app-core'
import { SearchField } from '@jbrowse/core/ui/ClearableSearchField'
import ControlRow from '@jbrowse/core/ui/ControlRow'
import VirtualTable, { useTableSort } from '@jbrowse/core/ui/VirtualTable'
import {
  buildSearchText,
  highlightPatterns,
  searchMatcher,
} from '@jbrowse/core/util/searchText'
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
  const [searchText, setSearchText] = useState('')
  const rows = buildRows(session)
  const matches = searchMatcher(searchText)
  const searched = matches
    ? rows?.filter(row => matches(buildSearchText([row.name, row.summary])))
    : rows
  const columns: VirtualTableColumn<Row>[] = [
    {
      id: 'name',
      header: 'Name',
      fill: true,
      sortValue: row => row.name,
      cell: row => <SessionRowCell row={row} session={session} />,
    },
  ]
  const { sortedRows, sortProps } = useTableSort(searched ?? [], columns)

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
        {rows && sortedRows.length !== rows.length ? (
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
      {rows ? (
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
            {...sortProps}
            resetKey={searchText}
            highlightPatterns={highlightPatterns(searchText)}
            emptyMessage={
              matches ? 'No matching sessions' : 'No saved sessions'
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
