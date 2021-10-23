import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'
import FileSelector from '@jbrowse/core/ui/FileSelector'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { FileLocation } from '@jbrowse/core/util/types'
import { ipcRenderer } from 'electron'

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
  if (adapterSelection === 'IndexedFastaAdapter') {
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
      </Grid>
    )
  }
  if (adapterSelection === 'BgzipFastaAdapter') {
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
        <Grid item>
          <FileSelector
            name="gziLocation"
            location={gziLocation}
            setLocation={loc => setGziLocation(loc)}
          />
        </Grid>
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

  if (adapterSelection === 'FastaAdapter') {
    return (
      <Grid container spacing={2}>
        <Grid item>
          <FileSelector
            name="fastaLocation"
            location={fastaLocation}
            setLocation={loc => setFastaLocation(loc)}
          />
        </Grid>
      </Grid>
    )
  }

  return null
}

const blank = { uri: '' } as FileLocation

const OpenSequenceDialog = ({
  onClose,
}: {
  onClose: (conf?: unknown) => Promise<void>
}) => {
  const classes = useStyles()

  const adapterTypes = [
    'IndexedFastaAdapter',
    'BgzipFastaAdapter',
    'FastaAdapter',
    'TwoBitAdapter',
  ]
  const [error, setError] = useState<unknown>()
  const [assemblyName, setAssemblyName] = useState('')
  const [assemblyDisplayName, setAssemblyDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [adapterSelection, setAdapterSelection] = useState(adapterTypes[0])
  const [fastaLocation, setFastaLocation] = useState(blank)
  const [faiLocation, setFaiLocation] = useState(blank)
  const [gziLocation, setGziLocation] = useState(blank)
  const [twoBitLocation, setTwoBitLocation] = useState(blank)
  const [chromSizesLocation, setChromSizesLocation] = useState(blank)

  async function createAssemblyConfig() {
    if (adapterSelection === 'FastaAdapter') {
      setMessage('Creating .fai for file...')
      const faiLocation = await ipcRenderer.invoke('indexFasta', fastaLocation)
      setMessage('Finished creating fasta file')
      setTimeout(() => {
        setMessage('')
      }, 1000)
      return {
        name: assemblyName,
        displayName: assemblyDisplayName,
        sequence: {
          adapter: {
            type: 'IndexedFastaAdapter',
            fastaLocation,
            faiLocation: { localPath: faiLocation },
          },
        },
      }
    }
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
        {error ? <ErrorMessage error={error} /> : null}
        <div className={classes.root}>
          <Typography>
            Use this dialog to open a new indexed FASTA file, bgzipped+indexed
            FASTA file, or .2bit file of a genome assembly or other sequence
          </Typography>
          {message ? <Typography>{message}</Typography> : null}
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
              const assemblyConf = await createAssemblyConfig()

              await onClose({
                ...assemblyConf,
                sequence: {
                  type: 'ReferenceSequenceTrack',
                  trackId: `${assemblyName}-${Date.now()}`,
                  ...(assemblyConf.sequence || {}),
                },
              })
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
