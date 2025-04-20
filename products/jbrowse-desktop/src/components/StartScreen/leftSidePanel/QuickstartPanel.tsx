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
import { Button, Checkbox, IconButton, Typography } from '@mui/material'
import useSWR from 'swr'
import { makeStyles } from 'tss-react/mui'

import { useInnerDims } from '../availableGenomes/util'
import DeleteQuickstartDialog from '../dialogs/DeleteQuickstartDialog'
import RenameQuickstartDialog from '../dialogs/RenameQuickstartDialog'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  button: {
    margin: theme.spacing(2),
  },
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
  },
}))

export default function QuickstartPanel({
  launch,
}: {
  launch: (arg0: string[]) => void
}) {
  const { classes } = useStyles()
  const [selected, setSelected] = useState({} as Record<string, boolean>)
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
      <div className={classes.headerContainer}>
        <IconButton
          size="small"
          onClick={() => {
            setIsVisible(!isVisible)
          }}
        >
          {isVisible ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Typography variant="h6" className={classes.mb}>
          Quickstart list
        </Typography>
        {isVisible ? (
          <Button
            className={classes.button}
            onClick={() => {
              launch(
                Object.keys(selected).filter(
                  n => selected[n] && quickstarts?.includes(n),
                ),
              )
            }}
            variant="contained"
            disabled={!Object.values(selected).some(Boolean)}
          >
            Go
          </Button>
        ) : null}
      </div>

      {isVisible ? (
        <div className={classes.panel}>
          {e ? <ErrorMessage error={e} /> : null}

          {quickstarts ? (
            <div
              className={classes.tableContainer}
              style={{ maxHeight: innerHeight / 4 }}
            >
              <table>
                <tbody>
                  {quickstarts.map(name => (
                    <tr key={name}>
                      <td>
                        <Checkbox
                          style={{ padding: 0 }}
                          checked={selected[name] || false}
                          onChange={() => {
                            setSelected({
                              ...selected,
                              [name]: !selected[name],
                            })
                          }}
                        />
                      </td>
                      <td>
                        {name}{' '}
                        <CascadingMenuButton
                          style={{ padding: 0 }}
                          menuItems={[
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
                  ))}
                </tbody>
              </table>
            </div>
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
