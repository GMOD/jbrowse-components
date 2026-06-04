import { ActionLink } from '@jbrowse/core/ui'
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
  Tooltip,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { differenceInDays, formatDistanceToNow } from 'date-fns'
import { observer } from 'mobx-react'

import type { SessionModel } from './util.ts'

interface Row {
  id: string
  name: string
  createdAt: Date
  fav: boolean
}

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
  const rows: Row[] | undefined = session.savedSessionMetadata
    ?.map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      fav: r.favorite,
    }))
    .filter(f => !showOnlyFavs || f.fav)

  async function handleDeleteOld() {
    const toDelete = (session.savedSessionMetadata ?? []).filter(
      elt => differenceInDays(Date.now(), elt.createdAt) > 1 && !elt.favorite,
    )
    await Promise.all(toDelete.map(elt => session.deleteSavedSession(elt.id)))
    session.notify(`${toDelete.length} sessions deleted`, 'info')
  }

  const columns = [
    {
      field: 'fav',
      headerName: 'Fav',
      width: 20,
      renderCell: ({ row }: { row: Row }) => (
        <IconButton
          onClick={() => {
            void session.setSavedSessionFavorite(row.id, !row.fav)
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
      renderCell: ({ row }: { row: Row }) => (
        <>
          <ActionLink
            onClick={() => {
              void session.activateSession(row.id)
            }}
          >
            {row.name}
          </ActionLink>
          {session.id === row.id ? ' (current)' : ''}
        </>
      ),
    },
    {
      headerName: 'Created at',
      field: 'createdAt',
      renderCell: ({ row }: { row: Row }) => (
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
      renderCell: ({ row }: { row: Row }) => (
        <IconButton
          onClick={() => {
            void session.deleteSavedSession(row.id)
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
        <Button
          variant="contained"
          onClick={() => {
            handleDeleteOld().catch((e: unknown) => {
              console.error(e)
              session.notifyError(`${e}`, e)
            })
          }}
        >
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
            showToolbar
            slotProps={{ toolbar: { showQuickFilter: true } }}
            rows={rows}
            columns={columns}
            processRowUpdate={(newRow: Row, oldRow: Row) => {
              if (newRow.name !== oldRow.name) {
                void session.renameSavedSession(newRow.id, newRow.name)
              }
              return newRow
            }}
            onProcessRowUpdateError={e => {
              console.error(e)
              session.notifyError(`${e}`, e)
            }}
          />
        </DataGridFlexContainer>
      ) : (
        <div>No sessions loaded</div>
      )}
    </div>
  )
})

export default SessionManager
