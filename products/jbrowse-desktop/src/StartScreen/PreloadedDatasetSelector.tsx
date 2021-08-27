import React, { useState } from 'react'
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  makeStyles,
} from '@material-ui/core'
import PluginManager from '@jbrowse/core/PluginManager'
import { createPluginManager } from './util'
import preloadedConfigs from './preloadedConfigs'

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

function PreloadedDatasetSelector({
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

export default PreloadedDatasetSelector
