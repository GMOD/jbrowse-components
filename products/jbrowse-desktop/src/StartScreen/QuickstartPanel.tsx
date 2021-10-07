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
import { ipcRenderer } from 'electron'
import deepmerge from 'deepmerge'

// locals
import { createPluginManager } from './util'

const useStyles = makeStyles(theme => ({
  button: {
    float: 'right',
    height: '3em',
    margin: theme.spacing(2),
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

function PreloadedDatasetSelector({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const classes = useStyles()
  const [selected, setSelected] = useState({} as Record<string, boolean>)
  const [search, setSearch] = useState('')
  const [filterShown, setFilterShown] = useState(false)
  const [quickstarts, setQuickstarts] = useState<string[]>()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const quick = await ipcRenderer.invoke('listQuickstarts')
      if (!cancelled) {
        setQuickstarts(quick)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <Typography variant="h6">
        Select from this quickstart list
        <IconButton onClick={() => setFilterShown(!filterShown)}>
          <Tooltip title="Show filter?">
            <SearchIcon />
          </Tooltip>
        </IconButton>
      </Typography>
      <Button
        className={classes.button}
        onClick={async () => {
          const config = deepmerge.all(
            await Promise.all(
              Object.keys(selected)
                .filter(name => selected[name])
                .map(entry => ipcRenderer.invoke('getQuickstart', entry)),
            ),
          )

          // @ts-ignore
          config.defaultSession.name = `New session ${new Date().toLocaleString(
            'en-US',
          )}`
          const pm = await createPluginManager(config)
          setPluginManager(pm)
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
        {quickstarts ? (
          quickstarts
            .filter(name =>
              search ? name.match(new RegExp(search, 'i')) : true,
            )
            .map(name => (
              <div style={{ display: 'flex' }}>
                <FormControlLabel
                  key={name}
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
                  onClick={e => setAnchorEl(e.currentTarget)}
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

      <Menu
        keepMounted
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {}}>
          <Typography>Delete</Typography>
        </MenuItem>
        <MenuItem onClick={() => {}}>
          <Typography>Rename</Typography>
        </MenuItem>
      </Menu>
    </div>
  )
}

export default PreloadedDatasetSelector
