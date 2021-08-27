import React, { useState } from 'react'
import {
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import { createPluginManager } from './util'
import preloadedConfigs from './preloadedConfigs'

const useStyles = makeStyles(theme => ({
  container: {
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 200,
  },
  pointer: {
    cursor: 'pointer',
  },
  button: {
    float: 'right',
    height: '3em',
    margin: theme.spacing(2),
  },
  header: {
    marginBottom: theme.spacing(4),
  },
  paper: {
    width: '100%',
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
    <Paper className={classes.container}>
      <div style={{ display: 'flex' }}>
        <Typography className={classes.header}>
          Select assembly (or multiple assemblies) for your session
        </Typography>
        <Button
          className={classes.button}
          onClick={async () => {
            const name = Object.keys(selected)[0]
            const pm = await createPluginManager(
              // @ts-ignore
              preloadedConfigs[name],
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
        label="Search"
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
    </Paper>
  )
}

export default PreloadedDatasetSelector
