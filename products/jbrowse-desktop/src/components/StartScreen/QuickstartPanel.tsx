import React, { useState, useEffect } from 'react'
import { LoadingEllipses } from '@jbrowse/core/ui'
import MoreIcon from '@mui/icons-material/MoreHoriz'
import SearchIcon from '@mui/icons-material/Search'
import {
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import deepmerge from 'deepmerge'
import { makeStyles } from 'tss-react/mui'

// locals
import DeleteQuickstartDialog from './dialogs/DeleteQuickstartDialog'
import RenameQuickstartDialog from './dialogs/RenameQuickstartDialog'
import { loadPluginManager } from './util'
import type PluginManager from '@jbrowse/core/PluginManager'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  button: {
    float: 'right',
    height: '3em',
    margin: theme.spacing(2),
  },
  checkboxContainer: {
    display: 'flex',
  },
  checkbox: {
    display: 'block',
    marginRight: 0,
  },
  panel: {
    marginTop: theme.spacing(2),
    maxHeight: 500,
  },
}))

function QuickstartPanel({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const { classes } = useStyles()
  const [selected, setSelected] = useState({} as Record<string, boolean>)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<unknown>()
  const [filterShown, setFilterShown] = useState(false)
  const [quickstarts, setQuickstarts] = useState<string[]>()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [currentEl, setCurrentEl] = useState<string>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string>()
  const [renameDialogOpen, setRenameDialogOpen] = useState<string>()

  useEffect(() => {
    let cancelled = false

    let timeout: ReturnType<typeof setTimeout>
    async function fun() {
      // probably ok for this to not

      try {
        const quick = await ipcRenderer.invoke('listQuickstarts')
        if (!cancelled) {
          setQuickstarts(quick)
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
      timeout = setTimeout(fun, 500)
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    fun()

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div>
      <Typography variant="h6" style={{ marginBottom: 5 }}>
        Quickstart list
      </Typography>
      <Typography>
        Select one or more entries from this quickstart list to start your
        session. If more than one entry is selected, they will be combined
        <IconButton
          onClick={() => {
            setFilterShown(!filterShown)
          }}
        >
          <Tooltip title="Show filter?">
            <SearchIcon />
          </Tooltip>
        </IconButton>
      </Typography>
      <Button
        className={classes.button}
        onClick={async () => {
          try {
            const config = deepmerge.all(
              await Promise.all(
                Object.keys(selected)
                  .filter(name => selected[name] && quickstarts?.includes(name))
                  .map(entry => ipcRenderer.invoke('getQuickstart', entry)),
              ),
            )

            // @ts-expect-error
            config.defaultSession.name = `New session ${new Date().toLocaleString(
              'en-US',
            )}`
            const path = await ipcRenderer.invoke(
              'createInitialAutosaveFile',
              config,
            )
            setPluginManager(await loadPluginManager(path))
          } catch (e) {
            console.error(e)
            setError(e)
          }
        }}
        variant="contained"
        disabled={!Object.values(selected).some(Boolean)}
      >
        Go
      </Button>
      {filterShown ? (
        <TextField
          label="Filter datasets"
          value={search}
          onChange={event => {
            setSearch(event.target.value)
          }}
        />
      ) : null}
      <div className={classes.panel}>
        {error ? (
          <Typography variant="h6" color="error">{`${error}`}</Typography>
        ) : null}

        {quickstarts ? (
          quickstarts
            .filter(name =>
              search ? new RegExp(search, 'i').exec(name) : true,
            )
            .map(name => (
              <div key={name} className={classes.checkboxContainer}>
                <FormControlLabel
                  className={classes.checkbox}
                  control={
                    <Checkbox
                      checked={selected[name] || false}
                      onChange={() => {
                        setSelected({ ...selected, [name]: !selected[name] })
                      }}
                    />
                  }
                  label={name}
                />
                <IconButton
                  onClick={e => {
                    setCurrentEl(name)
                    setAnchorEl(e.currentTarget)
                  }}
                >
                  <MoreIcon />
                </IconButton>
              </div>
            ))
        ) : (
          <LoadingEllipses />
        )}
      </div>

      {anchorEl ? (
        <Menu
          keepMounted
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => {
            setAnchorEl(null)
          }}
        >
          <MenuItem
            onClick={() => {
              setDeleteDialogOpen(currentEl)
              setAnchorEl(null)
            }}
          >
            <Typography>Delete</Typography>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setRenameDialogOpen(currentEl)
              setAnchorEl(null)
            }}
          >
            <Typography>Rename</Typography>
          </MenuItem>
        </Menu>
      ) : null}

      {deleteDialogOpen && currentEl ? (
        <DeleteQuickstartDialog
          quickstartToDelete={currentEl}
          onClose={() => {
            setDeleteDialogOpen(undefined)
          }}
        />
      ) : null}

      {renameDialogOpen && currentEl && quickstarts ? (
        <RenameQuickstartDialog
          quickstartNames={quickstarts}
          quickstartToRename={currentEl}
          onClose={() => {
            setRenameDialogOpen(undefined)
          }}
        />
      ) : null}
    </div>
  )
}

export default QuickstartPanel
