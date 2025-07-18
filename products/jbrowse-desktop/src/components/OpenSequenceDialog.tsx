import { useState } from 'react'

import {
  Dialog,
  ErrorMessage,
  FileSelector,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { FileLocation } from '@jbrowse/core/util/types'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  message: {
    background: '#ddd',
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },
  paper: {
    padding: theme.spacing(2),
    margin: theme.spacing(2),
  },
  stagedAssemblies: {
    background: '#dfd',
    margin: theme.spacing(4),
    padding: theme.spacing(2),
  },
}))

const blank = { uri: '' } as FileLocation

function isBlank(location: FileLocation) {
  return 'uri' in location && location.uri === ''
}

const AdapterSelector = observer(function ({
  adapterSelection,
  setAdapterSelection,
  adapterTypes,
}: {
  adapterSelection: AdapterType
  setAdapterSelection: (arg: AdapterType) => void
  adapterTypes: readonly string[]
}) {
  return (
    <TextField
      value={adapterSelection}
      label="Type"
      variant="outlined"
      select
      helperText="Type of adapter to use"
      fullWidth
      onChange={event => {
        setAdapterSelection(event.target.value as AdapterType)
      }}
    >
      {adapterTypes.map(str => (
        <MenuItem key={str} value={str}>
          {str}
        </MenuItem>
      ))}
    </TextField>
  )
})

const FastaAdapterInput = observer(function ({
  fastaLocation,
  setFastaLocation,
}: {
  fastaLocation: FileLocation
  setFastaLocation: (arg: FileLocation) => void
}) {
  return (
    <>
      <Alert severity="warning" style={{ margin: 8 }}>
        Note: use only relatively small files for this type, it will be indexed
        on submit
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

const IndexedFastaAdapterInput = observer(function ({
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

const BgzipFastaAdapterInput = observer(function ({
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

const TwoBitAdapterInput = observer(function ({
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

const adapterTypes = [
  'IndexedFastaAdapter',
  'BgzipFastaAdapter',
  'FastaAdapter',
  'TwoBitAdapter',
] as const

type AdapterType =
  | 'IndexedFastaAdapter'
  | 'BgzipFastaAdapter'
  | 'FastaAdapter'
  | 'TwoBitAdapter'

const OpenSequenceDialog = observer(
  ({ onClose }: { onClose: (conf?: unknown) => Promise<void> }) => {
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

    function getAdapterConfig() {
      if (adapterSelection === 'FastaAdapter') {
        if (isBlank(fastaLocation)) {
          throw new Error('FASTA location is required')
        }
        return {
          type: 'IndexedFastaAdapter',
          fastaLocation,
          needsIndexing: true,
        }
      }
      if (adapterSelection === 'IndexedFastaAdapter') {
        if (isBlank(fastaLocation) || isBlank(faiLocation)) {
          throw new Error('Both FASTA and FAI locations are required')
        }
        return {
          type: 'IndexedFastaAdapter',
          fastaLocation,
          faiLocation,
        }
      }
      if (adapterSelection === 'BgzipFastaAdapter') {
        if (
          isBlank(fastaLocation) ||
          isBlank(faiLocation) ||
          isBlank(gziLocation)
        ) {
          throw new Error('FASTA, FAI, and GZI locations are all required')
        }
        return {
          type: 'BgzipFastaAdapter',
          fastaLocation,
          faiLocation,
          gziLocation,
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (adapterSelection === 'TwoBitAdapter') {
        if (isBlank(twoBitLocation)) {
          throw new Error('2bit location is required')
        }
        return {
          type: 'TwoBitAdapter',
          twoBitLocation,
          chromSizesLocation,
        }
      }
      throw new Error('Unknown adapter type')
    }

    async function createAssemblyConfig() {
      const adapterConfig = getAdapterConfig()

      if (adapterConfig.needsIndexing) {
        setLoading('Creating .fai file for FASTA')
        const faiLocation = await ipcRenderer.invoke(
          'indexFasta',
          fastaLocation,
        )
        adapterConfig.faiLocation = { localPath: faiLocation }
        delete adapterConfig.needsIndexing
      }

      return {
        name: assemblyName,
        displayName: assemblyDisplayName,
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${assemblyName}-${Date.now()}`,
          adapter: adapterConfig,
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
                  cytobandsLocation: cytobandsLocation,
                },
              },
            }
          : {}),
      }
    }
    return (
      <Dialog open onClose={() => onClose()} title="Open sequence(s)">
        <DialogContent>
          <Typography>
            Use this dialog to open one or more indexed FASTA files
            (IndexedFastaAdapter), bgzipped+indexed FASTA files
            (BgzipFastaAdapter), or .2bit files (TwoBitAdapter) of a genome
            assembly or other sequence. A plain FASTA file can also be supplied
            (FastaAdapter), which will be indexed on submit.
          </Typography>

          {assemblyConfs.length ? (
            <Typography className={classes.stagedAssemblies}>
              Currently staged assemblies:{' '}
              {assemblyConfs.map(conf => conf.name).join(', ')}
            </Typography>
          ) : null}

          {loading ? (
            <LoadingEllipses className={classes.message}>
              {loading}
            </LoadingEllipses>
          ) : null}

          {error ? <ErrorMessage error={error} /> : null}

          <Paper className={classes.paper}>
            <TextField
              label="Assembly name"
              helperText="The assembly name e.g. hg38"
              variant="outlined"
              value={assemblyName}
              onChange={event => {
                setAssemblyName(event.target.value)
              }}
            />

            <AdapterSelector
              adapterSelection={adapterSelection}
              adapterTypes={adapterTypes}
              setAdapterSelection={setAdapterSelection}
            />

            {adapterSelection === 'FastaAdapter' ? (
              <FastaAdapterInput
                fastaLocation={fastaLocation}
                setFastaLocation={setFastaLocation}
              />
            ) : adapterSelection === 'IndexedFastaAdapter' ? (
              <IndexedFastaAdapterInput
                fastaLocation={fastaLocation}
                faiLocation={faiLocation}
                setFastaLocation={setFastaLocation}
                setFaiLocation={setFaiLocation}
              />
            ) : adapterSelection === 'BgzipFastaAdapter' ? (
              <BgzipFastaAdapterInput
                fastaLocation={fastaLocation}
                faiLocation={faiLocation}
                gziLocation={gziLocation}
                setFastaLocation={setFastaLocation}
                setFaiLocation={setFaiLocation}
                setGziLocation={setGziLocation}
              />
            ) : (
              <TwoBitAdapterInput
                twoBitLocation={twoBitLocation}
                chromSizesLocation={chromSizesLocation}
                setTwoBitLocation={setTwoBitLocation}
                setChromSizesLocation={setChromSizesLocation}
              />
            )}
          </Paper>

          <Button
            onClick={() => {
              setShowAdvanced(a => !a)
            }}
            variant="contained"
          >
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </Button>
          {showAdvanced ? (
            <Paper className={classes.paper}>
              <TextField
                label="Assembly display name"
                helperText='(optional) A human readable display name for the assembly e.g. "Homo sapiens (hg38)"'
                variant="outlined"
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
            </Paper>
          ) : null}
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
            onClick={() => onClose()}
            color="secondary"
            variant="contained"
          >
            Cancel
          </Button>
          <Button
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
  },
)

export default OpenSequenceDialog
