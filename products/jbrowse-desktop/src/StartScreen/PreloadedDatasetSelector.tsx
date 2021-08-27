import React, { useState } from 'react'
import {
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import { createPluginManager } from './util'
import preloadedConfigs from './preloadedConfigs'
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
  header: {
    marginRight: theme.spacing(4),
    marginBottom: theme.spacing(4),
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

  return (
    <div className={classes.container}>
      <div style={{ display: 'flex' }}>
        <Typography className={classes.header}>
          Select assembly (or multiple assemblies) for your session
        </Typography>
        <Button
          className={classes.button}
          onClick={async () => {
            const pm = await createPluginManager(
              deepmerge.all(
                // @ts-ignore
                Object.keys(selected).map(name => preloadedConfigs[name]),
              ),
            )
            setPluginManager(pm)
          }}
          variant="contained"
          color="primary"
        >
          Go
        </Button>
      </div>
      <TextField
        label="Filter datasets"
        value={search}
        onChange={event => setSearch(event.target.value as string)}
      />
      <br />
      {Object.keys(preloadedConfigs)
        .filter(name => (search ? name.match(new RegExp(search, 'i')) : true))
        .map(name => (
          <>
            <FormControlLabel
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
            <br />
          </>
        ))}
    </div>
  )
}

export default PreloadedDatasetSelector
