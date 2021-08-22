import React, { useState } from 'react'
import {
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  makeStyles,
} from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import { createPluginManager } from './util'

const preloadedSessions = {
  hg38: {},
  mm10: {},
  hg19: {},
}

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 200,
    maxWidth: 300,
  },
  button: {
    minWidth: 200,
  },
}))

function load(
  setError: (e: string) => void,
  setSnapshotError: (e: Error) => void,
) {
  try {
  } catch (e) {
    console.error(e)
    const match = e.message.match(
      /.*at path "(.*)" snapshot `(.*)` is not assignable/,
    )
    // best effort to make a better error message than the default
    // mobx-state-tree
    if (match) {
      setError(`Failed to load element at ${match[1]}`)
      setSnapshotError(match[2])
    } else {
      const additionalMsg =
        e.message.length > 10000 ? '... see console for more' : ''
      throw new Error(e.message.slice(0, 10000) + additionalMsg)
    }
    console.error(e)
  }
}

export default function StartScreenOptionsPanel({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const classes = useStyles()
  return (
    <Grid item xs={4}>
      <Grid container spacing={1} direction="column" alignItems="center">
        <Grid item>
          <Button
            variant="contained"
            color="primary"
            className={classes.button}
          >
            Open sequence file
          </Button>
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            color="primary"
            className={classes.button}
          >
            Open data directory
          </Button>
        </Grid>
        <Grid item>
          <PreloadedSelector setPluginManager={setPluginManager} />
        </Grid>
      </Grid>
    </Grid>
  )
}

function PreloadedSelector({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const classes = useStyles()
  const [assemblyChoice, setAssemblyChoice] = useState('hg38')
  return (
    <div style={{ display: 'flex' }}>
      <FormControl className={classes.formControl}>
        <InputLabel shrink>Pre-loaded datasets</InputLabel>
        <Select
          value={assemblyChoice}
          label="Pre-loaded datasets"
          onChange={event => setAssemblyChoice(event.target.value as string)}
        >
          {Object.keys(preloadedSessions).map(name => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <div style={{ margin: 'auto 0' }}>
        <Button
          onClick={async () => {
            setPluginManager(
              // @ts-ignore
              createPluginManager(preloadedSessions[assemblyChoice]),
            )
          }}
          variant="contained"
          color="primary"
        >
          Go
        </Button>
      </div>
    </div>
  )
}
