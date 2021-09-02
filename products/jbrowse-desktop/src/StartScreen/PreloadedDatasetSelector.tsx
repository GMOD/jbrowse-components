import React, { useState } from 'react'
import {
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  makeStyles,
} from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import SearchIcon from '@material-ui/icons/Search'
import { createPluginManager } from './util'
import preloadedConfigs from './data/preloadedConfigs'
import deepmerge from 'deepmerge'

const useStyles = makeStyles(theme => ({
  container: {
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },

  button: {
    float: 'right',
    height: '3em',
    margin: theme.spacing(2),
  },
  checkbox: {
    display: 'block',
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

  return (
    <div className={classes.container}>
      <Typography>
        Select assembly (or multiple assemblies) for your session, and then hit
        "Go"
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
            // @ts-ignore
            Object.keys(selected).map(name => preloadedConfigs[name]),
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
      >
        Go
      </Button>
      {filterShown ? (
        <TextField
          label="Filter datasets"
          value={search}
          onChange={event => setSearch(event.target.value as string)}
        />
      ) : null}
      <br />
      {Object.keys(preloadedConfigs)
        .filter(name => (search ? name.match(new RegExp(search, 'i')) : true))
        .map(name => (
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
        ))}
    </div>
  )
}

export default PreloadedDatasetSelector
