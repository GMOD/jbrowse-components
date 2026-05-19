import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { measureGridWidth, useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import {
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Link,
  Tooltip,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { differenceInDays, formatDistanceToNow } from 'date-fns'
import { observer } from 'mobx-react'

import type { SessionModel } from './util.ts'

const useStyles = makeStyles()(theme => ({
  mb: {
    margin: theme.spacing(1),
    marginBottom: theme.spacing(4),
  },
}))

const SessionManager = observer(function SessionManager({
  session,
}: {
  session: SessionModel
}) {
  const { classes } = useStyles()
  const [showOnlyFavs, setShowOnlyFavs] = useLocalStorage(
    'sessionManager-showOnlyFavs',
    false,
  )
  const rows = session.savedSessionMetadata
    ?.map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      fav: r.favorite,
    }))
    .filter(f => !showOnlyFavs || f.fav)

  function handleDeleteOld() {
    const toDelete = (session.savedSessionMetadata ?? []).filter(
      elt => differenceInDays(Date.now(), elt.createdAt) > 1 && !elt.favorite,
    )
    for (const elt of toDelete) {
      session.deleteSavedSession(elt.id)
    }
    session.notify(`${toDelete.length} sessions deleted`, 'info')
  }

  const columns = [
    {
      field: 'fav',
      headerName: 'Fav',
      width: 20,
      renderCell: ({ row }: { row: { id: string; fav: boolean } }) => (
        <IconButton
          onClick={() => {
            session.setSavedSessionFavorite(row.id, !row.fav)
          }}
        >
          {row.fav ? <StarIcon /> : <StarBorderIcon />}
        </IconButton>
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      editable: true,
      width: measureGridWidth((rows ?? []).map(r => r.name)),
      renderCell: ({ row }: { row: { id: string; name: string } }) => (
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
      ),
    },
    {
      headerName: 'Created at',
      field: 'createdAt',
      renderCell: ({ row }: { row: { createdAt: Date } }) => (
        <Tooltip
          disableInteractive
          slotProps={{ transition: { timeout: 0 } }}
          title={row.createdAt.toLocaleString()}
        >
          <div>{formatDistanceToNow(row.createdAt, { addSuffix: true })}</div>
        </Tooltip>
      ),
    },
    {
      field: 'delete',
      width: 10,
      headerName: 'Delete',
      renderCell: ({ row }: { row: { id: string } }) => (
        <IconButton
          onClick={() => {
            session.deleteSavedSession(row.id)
          }}
        >
          <DeleteIcon />
        </IconButton>
      ),
    },
  ]

  return (
    <div>
      <div className={classes.mb}>
        <FormControlLabel
          control={
            <Checkbox
              checked={showOnlyFavs}
              onChange={() => {
                setShowOnlyFavs(val => !val)
              }}
            />
          }
          label="Show favorites only?"
        />
        <Button variant="contained" onClick={() => { handleDeleteOld() }}>
          Delete non-fav sessions older than 1 day?
        </Button>
      </div>
      {rows ? (
        <DataGridFlexContainer>
          <DataGrid
            disableRowSelectionOnClick
            columnHeaderHeight={35}
            rowHeight={25}
            hideFooter={rows.length < 100}
            slotProps={{ toolbar: { showQuickFilter: true } }}
            rows={rows}
            columns={columns}
          />
        </DataGridFlexContainer>
      ) : (
        <div>No sessions loaded</div>
      )}
    </div>
  )
})

export default SessionManager
