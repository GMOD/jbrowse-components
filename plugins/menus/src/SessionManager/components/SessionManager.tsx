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
    .filter(f => (showOnlyFavs ? f.fav : true))

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
            let i = 0
            if (session.savedSessionMetadata) {
              for (const elt of session.savedSessionMetadata) {
                if (
                  differenceInDays(Date.now(), elt.createdAt) > 1 &&
                  !elt.favorite
                ) {
                  // @ts-expect-error
                  session.deleteSavedSession(elt.id)
                  i++
                }
              }
            }
            session.notify(`${i} sessions deleted`, 'info')
          }}
        >
          Delete non-fav sessions older than 7 days?
        </Button>
      </div>
      {rows ? (
        <DataGridFlexContainer>
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
                renderCell: ({ row }) => (
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
                ),
              },
              {
                field: 'name',
                headerName: 'Name',
                editable: true,
                width: measureGridWidth(rows.map(r => r.name)),
                renderCell: ({ row }) => (
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
                renderCell: ({ row }) => (
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
                      {formatDistanceToNow(row.createdAt, {
                        addSuffix: true,
                      })}
                    </div>
                  </Tooltip>
                ),
              },
              {
                field: 'delete',
                width: 10,
                headerName: 'Delete',
                renderCell: ({ row }) => (
                  <IconButton
                    onClick={() => {
                      // @ts-expect-error
                      session.deleteSavedSession(row.id)
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                ),
              },
            ]}
          />
        </DataGridFlexContainer>
      ) : (
        <div>No sessions loaded</div>
      )}
    </div>
  )
})

export default SessionManager
