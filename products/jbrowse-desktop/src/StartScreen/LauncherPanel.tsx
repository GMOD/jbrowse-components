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
import preloadedConfigs from './preloadedConfigs'
import OpenSequenceDialog from './OpenSequenceDialog'
import OpenDataDirectoryDialog from './OpenDataDirectoryDialog'

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 200,
  },
  button: {
    minWidth: 200,
    height: '3em',
  },
}))

export default function StartScreenOptionsPanel({
  setPluginManager,
}: {
  setPluginManager: (arg0: PluginManager) => void
}) {
  const classes = useStyles()
  const [sequenceDialogOpen, setSequenceDialogOpen] = useState(false)
  const [dataDirectoryDialogOpen, setDataDirectoryDialogOpen] = useState(false)
  return (
    <Grid item xs={4}>
      <Grid container spacing={5} direction="column" alignItems="center">
        <Grid item>
          <Button
            variant="contained"
            color="primary"
            className={classes.button}
            onClick={() => setSequenceDialogOpen(true)}
          >
            Open sequence file
          </Button>
        </Grid>
        <Grid item>
          <Button
            variant="contained"
            color="primary"
            className={classes.button}
            onClick={() => setDataDirectoryDialogOpen(true)}
          >
            Open data directory
          </Button>
        </Grid>
        <Grid item>
          <PreloadedSelector setPluginManager={setPluginManager} />
        </Grid>
      </Grid>
      {sequenceDialogOpen ? (
        <OpenSequenceDialog
          onClose={() => setSequenceDialogOpen(false)}
          setPluginManager={setPluginManager}
        />
      ) : null}
      {dataDirectoryDialogOpen ? (
        <OpenDataDirectoryDialog
          onClose={() => setDataDirectoryDialogOpen(false)}
          setPluginManager={setPluginManager}
        />
      ) : null}
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
          {Object.keys(preloadedConfigs).map(name => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <div style={{ margin: 'auto 0' }}>
        <Button
          onClick={async () => {
            const pm = await createPluginManager(
              // @ts-ignore
              preloadedConfigs[assemblyChoice],
            )
            setPluginManager(pm)
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
