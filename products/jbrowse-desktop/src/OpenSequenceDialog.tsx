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
  message: {
    background: '#ddd',
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },
  paper: {
    padding: theme.spacing(2),
    margin: theme.spacing(2),
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

function isBlank(location: FileLocation) {
  return 'uri' in location && location.uri === ''
}

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
  const [loading, setLoading] = useState<string>()
  const [adapterSelection, setAdapterSelection] = useState(adapterTypes[0])
  const [fastaLocation, setFastaLocation] = useState(blank)
  const [faiLocation, setFaiLocation] = useState(blank)
  const [gziLocation, setGziLocation] = useState(blank)
  const [twoBitLocation, setTwoBitLocation] = useState(blank)
  const [chromSizesLocation, setChromSizesLocation] = useState(blank)

  async function createAssemblyConfig() {
    if (adapterSelection === 'FastaAdapter') {
      setLoading('Creating .fai file for FASTA')
      const faiLocation = await ipcRenderer.invoke('indexFasta', fastaLocation)
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
      if (isBlank(fastaLocation) || isBlank(faiLocation)) {
        throw new Error('Need both fastaLocation and faiLocation')
      }
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
      if (
        isBlank(fastaLocation) ||
        isBlank(faiLocation) ||
        isBlank(gziLocation)
      ) {
        throw new Error(
          'Need both fastaLocation and faiLocation and gziLocation',
        )
      }
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
      if (isBlank(twoBitLocation)) {
        throw new Error('Need twoBitLocation')
      }
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
        <Typography>
          Use this dialog to open a new indexed FASTA file, bgzipped+indexed
          FASTA file, or .2bit file of a genome assembly or other sequence
        </Typography>
        {loading ? (
          <Typography className={classes.message}>{loading}</Typography>
        ) : null}

        {error ? <ErrorMessage error={error} /> : null}

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
            helperText='(optional) A human readable display name for the assembly e.g. "Homo sapiens (hg38)"'
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
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} color="secondary" variant="contained">
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              setError(undefined)
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
            } finally {
              setLoading(undefined)
            }
          }}
          color="primary"
          disabled={!!loading}
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
