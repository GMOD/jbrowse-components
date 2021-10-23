import React, { useState, useEffect } from 'react'
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
  makeStyles,
} from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import SearchIcon from '@material-ui/icons/Search'
import MoreIcon from '@material-ui/icons/MoreHoriz'

import DeleteQuickstartDialog from './dialogs/DeleteQuickstartDialog'
import RenameQuickstartDialog from './dialogs/RenameQuickstartDialog'

import { ipcRenderer } from 'electron'
import deepmerge from 'deepmerge'

// locals
import { loadPluginManager } from './util'

const useStyles = makeStyles(theme => ({
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
  const classes = useStyles()
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
    async function updateQuickstarts() {
      try {
        const quick = await ipcRenderer.invoke('listQuickstarts')
        if (!cancelled) {
          setQuickstarts(quick)
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    }

    const interval = setInterval(() => {
      updateQuickstarts()
    }, 500)

    return () => {
      cancelled = true
      clearInterval(interval)
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
        <IconButton onClick={() => setFilterShown(!filterShown)}>
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

            // @ts-ignore
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
        color="primary"
        disabled={!Object.values(selected).some(Boolean)}
      >
        Go
      </Button>
      {filterShown ? (
        <TextField
          label="Filter datasets"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      ) : null}
      <div className={classes.panel}>
        {error ? (
          <Typography variant="h6" color="error">{`${error}`}</Typography>
        ) : null}

        {quickstarts ? (
          quickstarts
            .filter(name =>
              search ? name.match(new RegExp(search, 'i')) : true,
            )
            .map(name => (
              <div key={name} className={classes.checkboxContainer}>
                <FormControlLabel
                  className={classes.checkbox}
                  control={
                    <Checkbox
                      checked={selected[name] || false}
                      onChange={() =>
                        setSelected({ ...selected, [name]: !selected[name] })
                      }
                    />
                  }
                  label={name}
                />
                <IconButton
                  onClick={e => {
                    setCurrentEl(name)
                    setAnchorEl(e.currentTarget)
                  }}
                  color="secondary"
                >
                  <MoreIcon />
                </IconButton>
              </div>
            ))
        ) : (
          <Typography>Loading...</Typography>
        )}
      </div>

      {anchorEl ? (
        <Menu
          keepMounted
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
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
          onClose={() => setDeleteDialogOpen(undefined)}
        />
      ) : null}

      {renameDialogOpen && currentEl && quickstarts ? (
        <RenameQuickstartDialog
          quickstartNames={quickstarts}
          quickstartToRename={currentEl}
          onClose={() => setRenameDialogOpen(undefined)}
        />
      ) : null}
    </div>
  )
}

export default QuickstartPanel
