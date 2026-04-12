import { useState } from 'react'

import {
  Dialog,
  ErrorMessage,
  FileSelector,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Alert,
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  adapterLabels,
  adapterTypes,
  detectAdapterType,
  getAdapterConfig,
  getAssemblyNameFromFilename,
  getFilename,
  isBlank,
} from './util.ts'

import type { AdapterType } from './util.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  message: {
    background: theme.palette.grey[300],
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },
  paper: {
    padding: theme.spacing(2),
    margin: theme.spacing(2),
  },
  stagedAssemblies: {
    background: theme.palette.success.light,
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },
}))

const blank = { uri: '' } as FileLocation

const AdapterSelector = observer(function AdapterSelector({
  adapterSelection,
  setAdapterSelection,
}: {
  adapterSelection: AdapterType
  setAdapterSelection: (arg: AdapterType) => void
}) {
  return (
    <TextField
      value={adapterSelection}
      label="Format"
      variant="outlined"
      select
      fullWidth
      onChange={event => {
        setAdapterSelection(event.target.value as AdapterType)
      }}
    >
      {adapterTypes.map(type => (
        <MenuItem key={type} value={type}>
          {adapterLabels[type]}
        </MenuItem>
      ))}
    </TextField>
  )
})

const FastaAdapterInput = observer(function FastaAdapterInput({
  fastaLocation,
  setFastaLocation,
}: {
  fastaLocation: FileLocation
  setFastaLocation: (arg: FileLocation) => void
}) {
  return (
    <>
      <Alert severity="warning" style={{ margin: 8 }}>
        Note: a FASTA index will be generated on submit, might take a couple
        minutes and if the file is remote, it will be downloaded in full
      </Alert>
      <FileSelector
        inline
        name="FASTA file"
        location={fastaLocation}
        setLocation={setFastaLocation}
      />
    </>
  )
})

const IndexedFastaAdapterInput = observer(function IndexedFastaAdapterInput({
  fastaLocation,
  faiLocation,
  setFastaLocation,
  setFaiLocation,
}: {
  fastaLocation: FileLocation
  faiLocation: FileLocation
  setFastaLocation: (arg: FileLocation) => void
  setFaiLocation: (arg: FileLocation) => void
}) {
  return (
    <>
      <FileSelector
        inline
        name="FASTA file"
        location={fastaLocation}
        setLocation={setFastaLocation}
      />
      <FileSelector
        inline
        name="FASTA index (.fai) file"
        location={faiLocation}
        setLocation={setFaiLocation}
      />
    </>
  )
})

const BgzipFastaAdapterInput = observer(function BgzipFastaAdapterInput({
  fastaLocation,
  faiLocation,
  gziLocation,
  setFastaLocation,
  setFaiLocation,
  setGziLocation,
}: {
  fastaLocation: FileLocation
  faiLocation: FileLocation
  gziLocation: FileLocation
  setFastaLocation: (arg: FileLocation) => void
  setFaiLocation: (arg: FileLocation) => void
  setGziLocation: (arg: FileLocation) => void
}) {
  return (
    <>
      <FileSelector
        inline
        name="FASTA file (.fa.gz)"
        location={fastaLocation}
        setLocation={setFastaLocation}
      />
      <FileSelector
        inline
        name="FASTA index (.fai) file"
        location={faiLocation}
        setLocation={setFaiLocation}
      />
      <FileSelector
        inline
        name="FASTA gzip index (.gzi) file"
        location={gziLocation}
        setLocation={setGziLocation}
      />
    </>
  )
})

const TwoBitAdapterInput = observer(function TwoBitAdapterInput({
  twoBitLocation,
  chromSizesLocation,
  setTwoBitLocation,
  setChromSizesLocation,
}: {
  twoBitLocation: FileLocation
  chromSizesLocation: FileLocation
  setTwoBitLocation: (arg: FileLocation) => void
  setChromSizesLocation: (arg: FileLocation) => void
}) {
  return (
    <>
      <FileSelector
        inline
        name="2bit file"
        location={twoBitLocation}
        setLocation={setTwoBitLocation}
      />
      <FileSelector
        inline
        name=".chrom.sizes (optional, can speed up loading 2bit files with many contigs)"
        location={chromSizesLocation}
        setLocation={setChromSizesLocation}
      />
    </>
  )
})

const OpenSequenceDialog = observer(function OpenSequenceDialog({
  onClose,
}: {
  onClose: (conf?: unknown) => Promise<void>
}) {
  const { classes } = useStyles()
  type AssemblyConf = Awaited<ReturnType<typeof createAssemblyConfig>>

  const [assemblyConfs, setAssemblyConfs] = useState<AssemblyConf[]>([])
  const [error, setError] = useState<unknown>()
  const [assemblyName, setAssemblyName] = useState('')
  const [assemblyDisplayName, setAssemblyDisplayName] = useState('')
  const [loading, setLoading] = useState('')
  const [adapterSelection, setAdapterSelection] = useState<AdapterType>(
    adapterTypes[0],
  )
  const [fastaLocation, setFastaLocation] = useState(blank)
  const [faiLocation, setFaiLocation] = useState(blank)
  const [gziLocation, setGziLocation] = useState(blank)
  const [twoBitLocation, setTwoBitLocation] = useState(blank)
  const [chromSizesLocation, setChromSizesLocation] = useState(blank)
  const [refNameAliasesLocation, setRefNameAliasesLocation] = useState(blank)
  const [cytobandsLocation, setCytobandsLocation] = useState(blank)
  const [showAdvanced, setShowAdvanced] = useState(false)

  function handlePrimaryFileChange(location: FileLocation) {
    const filename = getFilename(location)
    const detected = filename ? detectAdapterType(filename) : undefined
    if (detected === 'TwoBitAdapter') {
      setTwoBitLocation(location)
      setAdapterSelection('TwoBitAdapter')
    } else {
      setFastaLocation(location)
      if (detected) {
        setAdapterSelection(detected)
      }
    }
    if (filename && !assemblyName) {
      setAssemblyName(getAssemblyNameFromFilename(filename))
    }
  }

  function handleTwoBitLocationChange(location: FileLocation) {
    setTwoBitLocation(location)
    const filename = getFilename(location)
    if (filename && !assemblyName) {
      setAssemblyName(getAssemblyNameFromFilename(filename))
    }
  }

  function clearState() {
    setFastaLocation(blank)
    setFaiLocation(blank)
    setGziLocation(blank)
    setTwoBitLocation(blank)
    setChromSizesLocation(blank)
    setRefNameAliasesLocation(blank)
    setCytobandsLocation(blank)
    setAssemblyName('')
    setAssemblyDisplayName('')
  }

  async function createAssemblyConfig() {
    const raw = getAdapterConfig({
      adapterSelection,
      fastaLocation,
      faiLocation,
      gziLocation,
      twoBitLocation,
      chromSizesLocation,
    })
    let adapter
    if (raw.needsIndexing) {
      setLoading('Creating .fai file for FASTA')
      const faiPath = await ipcRenderer.invoke('indexFasta', fastaLocation)
      adapter = {
        type: 'IndexedFastaAdapter' as const,
        fastaLocation: raw.fastaLocation,
        faiLocation: {
          localPath: faiPath,
          locationType: 'LocalPathLocation' as const,
        },
      }
    } else {
      adapter = raw
    }
    return {
      name: assemblyName,
      ...(assemblyDisplayName ? { displayName: assemblyDisplayName } : {}),
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `${assemblyName}-${Date.now()}`,
        adapter,
      },
      ...(!isBlank(refNameAliasesLocation)
        ? {
            refNameAliases: {
              adapter: {
                type: 'RefNameAliasAdapter',
                location: refNameAliasesLocation,
              },
            },
          }
        : {}),
      ...(!isBlank(cytobandsLocation)
        ? {
            cytobands: {
              adapter: {
                type: 'CytobandAdapter',
                cytobandsLocation,
              },
            },
          }
        : {}),
    }
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (!loading) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          onClose()
        }
      }}
      title="Open genome(s)"
    >
      <DialogContent>
        {assemblyConfs.length ? (
          <Box className={classes.stagedAssemblies}>
            <Typography variant="body2" gutterBottom>
              Staged assemblies:
            </Typography>
            {assemblyConfs.map((conf, idx) => (
              <Chip
                key={conf.name}
                label={conf.name}
                onDelete={() => {
                  setAssemblyConfs(assemblyConfs.filter((_, i) => i !== idx))
                }}
                style={{ margin: 2 }}
              />
            ))}
          </Box>
        ) : null}

        {loading ? (
          <LoadingEllipses className={classes.message} message={loading} />
        ) : null}

        {error ? <ErrorMessage error={error} /> : null}

        <Paper className={classes.paper}>
          <TextField
            label="Assembly name"
            helperText="The assembly name e.g. hg38"
            variant="outlined"
            fullWidth
            value={assemblyName}
            onChange={event => {
              setAssemblyName(event.target.value)
            }}
          />

          <AdapterSelector
            adapterSelection={adapterSelection}
            setAdapterSelection={setAdapterSelection}
          />

          {adapterSelection === 'FastaAdapter' ? (
            <FastaAdapterInput
              fastaLocation={fastaLocation}
              setFastaLocation={handlePrimaryFileChange}
            />
          ) : adapterSelection === 'IndexedFastaAdapter' ? (
            <IndexedFastaAdapterInput
              fastaLocation={fastaLocation}
              faiLocation={faiLocation}
              setFastaLocation={handlePrimaryFileChange}
              setFaiLocation={setFaiLocation}
            />
          ) : adapterSelection === 'BgzipFastaAdapter' ? (
            <BgzipFastaAdapterInput
              fastaLocation={fastaLocation}
              faiLocation={faiLocation}
              gziLocation={gziLocation}
              setFastaLocation={handlePrimaryFileChange}
              setFaiLocation={setFaiLocation}
              setGziLocation={setGziLocation}
            />
          ) : (
            <TwoBitAdapterInput
              twoBitLocation={twoBitLocation}
              chromSizesLocation={chromSizesLocation}
              setTwoBitLocation={handleTwoBitLocationChange}
              setChromSizesLocation={setChromSizesLocation}
            />
          )}

          <Button
            variant="contained"
            style={{ marginTop: 10 }}
            onClick={() => {
              setShowAdvanced(a => !a)
            }}
          >
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </Button>
          {showAdvanced ? (
            <>
              <TextField
                label="Assembly display name"
                helperText='(optional) A human readable display name e.g. "Homo sapiens (hg38)"'
                variant="outlined"
                fullWidth
                value={assemblyDisplayName}
                onChange={event => {
                  setAssemblyDisplayName(event.target.value)
                }}
              />
              <FileSelector
                inline
                name="Add refName aliases e.g. remap chr1 and 1 to same entity. Can use a tab separated file of aliases, such as a .chromAliases files from UCSC"
                location={refNameAliasesLocation}
                setLocation={setRefNameAliasesLocation}
              />
              <FileSelector
                inline
                name="Add cytobands for assembly with the format of cytoBands.txt/cytoBandIdeo.txt from UCSC (.gz also allowed)"
                location={cytobandsLocation}
                setLocation={setCytobandsLocation}
              />
            </>
          ) : null}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={async () => {
            try {
              if (!assemblyName) {
                throw new Error('No assembly name set')
              }
              setError(undefined)
              const assemblyConf = await createAssemblyConfig()
              setAssemblyConfs([...assemblyConfs, assemblyConf])
              clearState()
            } catch (e) {
              setError(e)
              console.error(e)
            } finally {
              setLoading('')
            }
          }}
          disabled={!!loading}
          variant="contained"
          color="inherit"
        >
          Add another assembly
        </Button>
        <Button
          onClick={async () => {
            await onClose()
          }}
          color="secondary"
          variant="contained"
          disabled={!!loading}
        >
          Cancel
        </Button>
        <Button
          data-testid="open-sequence-submit"
          onClick={async () => {
            try {
              let confs = assemblyConfs
              if (assemblyName) {
                const assemblyConf = await createAssemblyConfig()
                confs = [...assemblyConfs, assemblyConf]
                setAssemblyConfs(confs)
              }
              if (!confs.length) {
                throw new Error('No assemblies specified')
              }
              await onClose(confs)
            } catch (e) {
              setError(e)
              console.error(e)
            } finally {
              setLoading('')
            }
          }}
          color="primary"
          disabled={!!loading}
          variant="contained"
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default OpenSequenceDialog
