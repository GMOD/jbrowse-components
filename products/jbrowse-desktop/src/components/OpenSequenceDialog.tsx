import React, { useState } from 'react'
import { Dialog, ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import AdapterInput from './AdapterInput'
import type { FileLocation } from '@jbrowse/core/util/types'

// locals

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

const adapterTypes = [
  'IndexedFastaAdapter',
  'BgzipFastaAdapter',
  'FastaAdapter',
  'TwoBitAdapter',
]

const OpenSequenceDialog = ({
  onClose,
}: {
  onClose: (conf?: unknown) => Promise<void>
}) => {
  const { classes } = useStyles()
  type AssemblyConf = Awaited<ReturnType<typeof createAssemblyConfig>>

  const [assemblyConfs, setAssemblyConfs] = useState<AssemblyConf[]>([])
  const [error, setError] = useState<unknown>()
  const [assemblyName, setAssemblyName] = useState('')
  const [assemblyDisplayName, setAssemblyDisplayName] = useState('')
  const [loading, setLoading] = useState('')
  const [adapterSelection, setAdapterSelection] = useState(adapterTypes[0]!)
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

  async function createAssemblyAdapterConfig() {
    if (adapterSelection === 'FastaAdapter') {
      setLoading('Creating .fai file for FASTA')
      const faiLocation = await ipcRenderer.invoke('indexFasta', fastaLocation)
      return {
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation,
          faiLocation: { localPath: faiLocation },
        },
      }
    }
    if (adapterSelection === 'IndexedFastaAdapter') {
      if (isBlank(fastaLocation) || isBlank(faiLocation)) {
        throw new Error('Need both fastaLocation and faiLocation')
      }
      return {
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation,
          faiLocation,
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
        adapter: {
          type: 'BgzipFastaAdapter',
          fastaLocation,
          faiLocation,
          gziLocation,
        },
      }
    } else if (adapterSelection === 'TwoBitAdapter') {
      if (isBlank(twoBitLocation)) {
        throw new Error('Need twoBitLocation')
      }
      return {
        adapter: {
          type: 'TwoBitAdapter',
          twoBitLocation,
          chromSizesLocation,
        },
      }
    }
    throw new Error('Unknown adapter type')
  }

  async function createAssemblyConfig() {
    return {
      name: assemblyName,
      displayName: assemblyDisplayName,
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `${assemblyName}-${Date.now()}`,
        ...(await createAssemblyAdapterConfig()),
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
          <Typography className={classes.message}>{loading}</Typography>
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

          <TextField
            label="Assembly display name"
            helperText='(optional) A human readable display name for the assembly e.g. "Homo sapiens (hg38)"'
            variant="outlined"
            value={assemblyDisplayName}
            onChange={event => {
              setAssemblyDisplayName(event.target.value)
            }}
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
            <FileSelector
              name="Add refName aliases e.g. remap chr1 and 1 to same entity. Can use a tab separated file of aliases, such as a .chromAliases files from UCSC"
              location={refNameAliasesLocation}
              setLocation={setRefNameAliasesLocation}
            />
            <FileSelector
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
        <Button onClick={() => onClose()} color="secondary" variant="contained">
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
}

export default OpenSequenceDialog
