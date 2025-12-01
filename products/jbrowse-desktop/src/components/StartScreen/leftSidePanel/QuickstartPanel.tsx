import { useState } from 'react'

import {
  CascadingMenuButton,
  ErrorMessage,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MoreIcon from '@mui/icons-material/MoreHoriz'
import { IconButton, Link, Typography } from '@mui/material'
import useSWR from 'swr'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { useInnerDims } from '../availableGenomes/util'
import DeleteQuickstartDialog from '../dialogs/DeleteQuickstartDialog'
import RenameQuickstartDialog from '../dialogs/RenameQuickstartDialog'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  panel: {
    marginTop: theme.spacing(2),
  },
  mb: {
    marginBottom: 5,
  },
  tableContainer: {
    overflow: 'auto',
  },
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
}))

export default function QuickstartPanel({
  launch,
}: {
  launch: (arg0: string[]) => void
}) {
  const { classes } = useStyles()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string>()
  const [renameDialogOpen, setRenameDialogOpen] = useState<string>()
  const [isVisible, setIsVisible] = useLocalStorage(
    'startScreen-quickstartMinimized',
    true,
  )
  const { height: innerHeight } = useInnerDims()

  const { data: quickstarts, error: listError } = useSWR(
    'listQuickstarts',
    () => ipcRenderer.invoke('listQuickstarts') as Promise<string[]>,
    {
      refreshInterval: 500,
    },
  )

  const e = listError
  return (
    <div>
      <div
        className={classes.headerContainer}
        onClick={() => {
          setIsVisible(!isVisible)
        }}
      >
        <IconButton size="small">
          {isVisible ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Typography variant="h6" className={classes.mb}>
          Quickstart list
        </Typography>
      </div>

      {isVisible ? (
        <div className={classes.panel}>
          {e ? <ErrorMessage error={e} /> : null}

          {quickstarts !== undefined ? (
            quickstarts.length ? (
              <div
                className={classes.tableContainer}
                style={{ maxHeight: innerHeight / 4 }}
              >
                <table>
                  <tbody>
                    {quickstarts.map(name => {
                      const handleLaunch = () => {
                        launch([name])
                      }

                      return (
                        <tr key={name}>
                          <td>
                            <Link
                              href="#"
                              onClick={event => {
                                event.preventDefault()
                                handleLaunch()
                              }}
                            >
                              {name}
                            </Link>{' '}
                            <CascadingMenuButton
                              style={{ padding: 0 }}
                              menuItems={[
                                {
                                  label: 'Launch',
                                  onClick: handleLaunch,
                                },
                                {
                                  label: 'Delete',
                                  onClick: () => {
                                    setDeleteDialogOpen(name)
                                  },
                                },
                                {
                                  label: 'Rename',
                                  onClick: () => {
                                    setRenameDialogOpen(name)
                                  },
                                },
                              ]}
                            >
                              <MoreIcon />
                            </CascadingMenuButton>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>No quickstarts available</div>
            )
          ) : (
            <LoadingEllipses />
          )}
        </div>
      ) : null}

      {deleteDialogOpen ? (
        <DeleteQuickstartDialog
          quickstartToDelete={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(undefined)
          }}
        />
      ) : null}

      {renameDialogOpen && quickstarts ? (
        <RenameQuickstartDialog
          quickstartNames={quickstarts}
          quickstartToRename={renameDialogOpen}
          onClose={() => {
            setRenameDialogOpen(undefined)
          }}
        />
      ) : null}
    </div>
  )
}
