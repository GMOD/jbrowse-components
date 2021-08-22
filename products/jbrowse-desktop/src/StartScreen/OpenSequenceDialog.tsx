import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Grid,
  MenuItem,
  Paper,
  TextField,
  makeStyles,
} from '@material-ui/core'
import FileSelector from '@jbrowse/core/ui/FileSelector'
import { FileLocation } from '@jbrowse/core/util/types'
import PluginManager from '@jbrowse/core/PluginManager'
import { createPluginManager } from './util'

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
    overflow: 'hidden',
    padding: theme.spacing(0, 3),
  },
  paper: {
    margin: `${theme.spacing(1)}px auto`,
    padding: theme.spacing(2),
  },
  createButton: {
    marginTop: '1em',
    justifyContent: 'center',
  },
  paperContent: {
    flex: 'auto',
    margin: `${theme.spacing(1)}px auto`,
    padding: theme.spacing(1),
    overflow: 'auto',
  },
}))

function AdapterSelector({
  adapterSelection,
  setAdapterSelection,
  adapterTypes,
}: {
  adapterSelection: string
  setAdapterSelection: Function
  adapterTypes: string[]
}) {
  return (
    <TextField
      value={adapterSelection}
      label="Type"
      select
      helperText="Type of adapter to use"
      fullWidth
      onChange={event => {
        setAdapterSelection(event.target.value)
      }}
    >
      {adapterTypes.map(str => (
        <MenuItem key={str} value={str}>
          {str}
        </MenuItem>
      ))}
    </TextField>
  )
}

function AdapterInput({
  adapterSelection,
  fastaLocation,
  setFastaLocation,
  faiLocation,
  setFaiLocation,
  chromSizesLocation,
  gziLocation,
  setGziLocation,
  twoBitLocation,
  setTwoBitLocation,
  setChromSizesLocation,
}: {
  adapterSelection: string
  fastaLocation: FileLocation
  setFastaLocation: Function
  faiLocation: FileLocation
  setFaiLocation: Function
  gziLocation: FileLocation
  chromSizesLocation: FileLocation
  setGziLocation: Function
  twoBitLocation: FileLocation
  setTwoBitLocation: Function
  setChromSizesLocation: Function
}) {
  if (
    adapterSelection === 'IndexedFastaAdapter' ||
    adapterSelection === 'BgzipFastaAdapter'
  ) {
    return (
      <Grid container spacing={2}>
        <Grid item>
          <FileSelector
            name="fastaLocation"
            location={fastaLocation}
            setLocation={loc => setFastaLocation(loc)}
          />
        </Grid>
        <Grid item>
          <FileSelector
            name="faiLocation"
            location={faiLocation}
            setLocation={loc => setFaiLocation(loc)}
          />
        </Grid>
        {adapterSelection === 'BgzipFastaAdapter' ? (
          <Grid item>
            <FileSelector
              name="gziLocation"
              location={gziLocation}
              setLocation={loc => setGziLocation(loc)}
            />
          </Grid>
        ) : null}
      </Grid>
    )
  }

  if (adapterSelection === 'TwoBitAdapter') {
    return (
      <Grid container spacing={2}>
        <Grid item>
          <FileSelector
            name="twoBitLocation"
            location={twoBitLocation}
            setLocation={loc => setTwoBitLocation(loc)}
          />
        </Grid>
        <Grid item>
          <FileSelector
            name="chromSizesLocation (optional, can be added to speed up loading 2bit files with many contigs)"
            location={chromSizesLocation}
            setLocation={loc => setChromSizesLocation(loc)}
          />
        </Grid>
      </Grid>
    )
  }

  return null
}

const OpenSequenceDialog = ({
  onClose,
  setPluginManager,
}: {
  setPluginManager: (pm: PluginManager) => void
  onClose: () => void
}) => {
  const classes = useStyles()

  const adapterTypes = [
    'IndexedFastaAdapter',
    'BgzipFastaAdapter',
    'TwoBitAdapter',
  ]
  const [error, setError] = useState<Error>()
  const [assemblyName, setAssemblyName] = useState('')
  const [assemblyDisplayName, setAssemblyDisplayName] = useState('')
  const [adapterSelection, setAdapterSelection] = useState(adapterTypes[0])
  const [fastaLocation, setFastaLocation] = useState({ uri: '' })
  const [faiLocation, setFaiLocation] = useState({ uri: '' })
  const [gziLocation, setGziLocation] = useState({ uri: '' })
  const [twoBitLocation, setTwoBitLocation] = useState({ uri: '' })
  const [chromSizesLocation, setChromSizesLocation] = useState({ uri: '' })

  function createAssemblyConfig() {
    if (adapterSelection === 'IndexedFastaAdapter') {
      return {
        name: assemblyName,
        displayName: assemblyDisplayName,
        sequence: {
          adapter: {
            type: 'IndexedFastaAdapter',
            fastaLocation,
            faiLocation,
          },
        },
      }
    } else if (adapterSelection === 'BgzipFastaAdapter') {
      return {
        name: assemblyName,
        displayName: assemblyDisplayName,
        sequence: {
          adapter: {
            type: 'BgzipFastaAdapter',
            fastaLocation,
            faiLocation,
            gziLocation,
          },
        },
      }
    } else if (adapterSelection === 'TwoBitAdapter') {
      return {
        name: assemblyName,
        displayName: assemblyDisplayName,
        sequence: {
          adapter: {
            type: 'TwoBitAdapter',
            twoBitLocation,
            chromSizesLocation,
          },
        },
      }
    }
    throw new Error('Unknown adapter type')
  }
  return (
    <Dialog open onClose={() => onClose()}>
      <DialogTitle>Open sequence</DialogTitle>
      <DialogContent>
        {error ? (
          <Typography variant="h6" color="error">{`${error}`}</Typography>
        ) : null}
        <div className={classes.root}>
          <Paper className={classes.paper}>
            <TextField
              id="assembly-name"
              inputProps={{ 'data-testid': 'assembly-name' }}
              defaultValue=""
              label="Assembly name"
              helperText="The assembly name e.g. hg38"
              variant="outlined"
              value={assemblyName}
              onChange={event => setAssemblyName(event.target.value)}
            />
            <TextField
              id="assembly-name"
              inputProps={{ 'data-testid': 'assembly-display-name' }}
              label="Assembly display name"
              helperText='A human readable display name for the assembly e.g. "Homo sapiens (hg38)"'
              variant="outlined"
              defaultValue=""
              value={assemblyDisplayName}
              onChange={event => setAssemblyDisplayName(event.target.value)}
            />
            <AdapterSelector
              adapterSelection={adapterSelection}
              setAdapterSelection={setAdapterSelection}
              adapterTypes={adapterTypes}
            />
            <div className={classes.paperContent}>
              <AdapterInput
                adapterSelection={adapterSelection}
                fastaLocation={fastaLocation}
                chromSizesLocation={chromSizesLocation}
                setFastaLocation={setFastaLocation}
                faiLocation={faiLocation}
                setFaiLocation={setFaiLocation}
                gziLocation={gziLocation}
                setGziLocation={setGziLocation}
                twoBitLocation={twoBitLocation}
                setTwoBitLocation={setTwoBitLocation}
                setChromSizesLocation={setChromSizesLocation}
              />
            </div>
          </Paper>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} color="secondary" variant="contained">
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              const assemblyConf = createAssemblyConfig()
              const pm = await createPluginManager({
                assemblies: [
                  {
                    ...assemblyConf,
                    sequence: {
                      type: 'ReferenceSequenceTrack',
                      trackId: `${assemblyName}-${Date.now()}`,
                      ...(assemblyConf.sequence || {}),
                    },
                  },
                ],
              })
              setPluginManager(pm)
              onClose()
            } catch (e) {
              setError(e)
              console.error(e)
            }
          }}
          color="primary"
          variant="contained"
          autoFocus
        >
          Open
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default OpenSequenceDialog
