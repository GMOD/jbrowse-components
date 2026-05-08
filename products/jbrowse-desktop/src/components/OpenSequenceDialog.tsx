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
  applyPrimaryFile,
  applyTwoBitFile,
  clearFormFields,
  getAdapterConfig,
  getBaseAssemblyConfig,
  initialFormState,
} from './util.ts'

import type { AdapterType, AssemblyConf, FormState } from './util.ts'
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

function FastaAdapterInput({
  form,
  setPrimaryFile,
}: {
  form: FormState
  setPrimaryFile: (l: FileLocation) => void
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
        location={form.fastaLocation}
        setLocation={setPrimaryFile}
      />
    </>
  )
}

function IndexedFastaAdapterInput({
  form,
  setPrimaryFile,
  setFaiLocation,
}: {
  form: FormState
  setPrimaryFile: (l: FileLocation) => void
  setFaiLocation: (l: FileLocation) => void
}) {
  return (
    <>
      <FileSelector
        inline
        name="FASTA file"
        location={form.fastaLocation}
        setLocation={setPrimaryFile}
      />
      <FileSelector
        inline
        name="FASTA index (.fai) file"
        location={form.faiLocation}
        setLocation={setFaiLocation}
      />
    </>
  )
}

function BgzipFastaAdapterInput({
  form,
  setPrimaryFile,
  setFaiLocation,
  setGziLocation,
}: {
  form: FormState
  setPrimaryFile: (l: FileLocation) => void
  setFaiLocation: (l: FileLocation) => void
  setGziLocation: (l: FileLocation) => void
}) {
  return (
    <>
      <FileSelector
        inline
        name="FASTA file (.fa.gz)"
        location={form.fastaLocation}
        setLocation={setPrimaryFile}
      />
      <FileSelector
        inline
        name="FASTA index (.fai) file"
        location={form.faiLocation}
        setLocation={setFaiLocation}
      />
      <FileSelector
        inline
        name="FASTA gzip index (.gzi) file"
        location={form.gziLocation}
        setLocation={setGziLocation}
      />
    </>
  )
}

function TwoBitAdapterInput({
  form,
  setTwoBitFile,
  setChromSizesLocation,
}: {
  form: FormState
  setTwoBitFile: (l: FileLocation) => void
  setChromSizesLocation: (l: FileLocation) => void
}) {
  return (
    <>
      <FileSelector
        inline
        name="2bit file"
        location={form.twoBitLocation}
        setLocation={setTwoBitFile}
      />
      <FileSelector
        inline
        name=".chrom.sizes (optional, can speed up loading 2bit files with many contigs)"
        location={form.chromSizesLocation}
        setLocation={setChromSizesLocation}
      />
    </>
  )
}

function AdvancedOptions({
  form,
  setAssemblyDisplayName,
  setRefNameAliasesLocation,
  setCytobandsLocation,
}: {
  form: FormState
  setAssemblyDisplayName: (n: string) => void
  setRefNameAliasesLocation: (l: FileLocation) => void
  setCytobandsLocation: (l: FileLocation) => void
}) {
  return (
    <>
      <TextField
        label="Assembly display name"
        helperText='(optional) A human readable display name e.g. "Homo sapiens (hg38)"'
        variant="outlined"
        fullWidth
        value={form.assemblyDisplayName}
        onChange={event => {
          setAssemblyDisplayName(event.target.value)
        }}
      />
      <FileSelector
        inline
        name="Add refName aliases e.g. remap chr1 and 1 to same entity. Can use a tab separated file of aliases, such as a .chromAliases files from UCSC"
        location={form.refNameAliasesLocation}
        setLocation={setRefNameAliasesLocation}
      />
      <FileSelector
        inline
        name="Add cytobands for assembly with the format of cytoBands.txt/cytoBandIdeo.txt from UCSC (.gz also allowed)"
        location={form.cytobandsLocation}
        setLocation={setCytobandsLocation}
      />
    </>
  )
}

const OpenSequenceDialog = observer(function OpenSequenceDialog({
  onClose,
}: {
  onClose: (conf?: unknown) => Promise<void>
}) {
  const { classes } = useStyles()
  const [form, setForm] = useState(initialFormState)
  const [assemblyConfs, setAssemblyConfs] = useState<AssemblyConf[]>([])
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const setPrimaryFile = (loc: FileLocation) => {
    setForm(f => applyPrimaryFile(f, loc))
  }
  const setTwoBitFile = (loc: FileLocation) => {
    setForm(f => applyTwoBitFile(f, loc))
  }
  const setFaiLocation = (loc: FileLocation) => {
    setForm(f => ({ ...f, faiLocation: loc }))
  }
  const setGziLocation = (loc: FileLocation) => {
    setForm(f => ({ ...f, gziLocation: loc }))
  }
  const setChromSizesLocation = (loc: FileLocation) => {
    setForm(f => ({ ...f, chromSizesLocation: loc }))
  }
  const setRefNameAliasesLocation = (loc: FileLocation) => {
    setForm(f => ({ ...f, refNameAliasesLocation: loc }))
  }
  const setCytobandsLocation = (loc: FileLocation) => {
    setForm(f => ({ ...f, cytobandsLocation: loc }))
  }
  const setAssemblyDisplayName = (name: string) => {
    setForm(f => ({ ...f, assemblyDisplayName: name }))
  }
  const setAdapterSelection = (type: AdapterType) => {
    setForm(f => ({ ...f, adapterSelection: type }))
  }

  async function createAssemblyConfig() {
    const raw = getAdapterConfig(form)
    let adapter
    if ('needsIndexing' in raw) {
      setLoading('Creating .fai file for FASTA')
      const faiPath = await ipcRenderer.invoke('indexFasta', form.fastaLocation)
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
      ...getBaseAssemblyConfig(form),
      sequence: {
        type: 'ReferenceSequenceTrack' as const,
        trackId: `${form.assemblyName}-${Date.now()}`,
        adapter,
      },
    }
  }

  return (
    <Dialog
      open
      onClose={async () => {
        if (!loading) {
          await onClose()
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
            value={form.assemblyName}
            onChange={event => {
              setForm(f => ({ ...f, assemblyName: event.target.value }))
            }}
          />

          <AdapterSelector
            adapterSelection={form.adapterSelection}
            setAdapterSelection={setAdapterSelection}
          />

          {form.adapterSelection === 'FastaAdapter' ? (
            <FastaAdapterInput form={form} setPrimaryFile={setPrimaryFile} />
          ) : form.adapterSelection === 'IndexedFastaAdapter' ? (
            <IndexedFastaAdapterInput
              form={form}
              setPrimaryFile={setPrimaryFile}
              setFaiLocation={setFaiLocation}
            />
          ) : form.adapterSelection === 'BgzipFastaAdapter' ? (
            <BgzipFastaAdapterInput
              form={form}
              setPrimaryFile={setPrimaryFile}
              setFaiLocation={setFaiLocation}
              setGziLocation={setGziLocation}
            />
          ) : (
            <TwoBitAdapterInput
              form={form}
              setTwoBitFile={setTwoBitFile}
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
            <AdvancedOptions
              form={form}
              setAssemblyDisplayName={setAssemblyDisplayName}
              setRefNameAliasesLocation={setRefNameAliasesLocation}
              setCytobandsLocation={setCytobandsLocation}
            />
          ) : null}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={async () => {
            try {
              if (!form.assemblyName) {
                throw new Error('No assembly name set')
              }
              setError(undefined)
              const assemblyConf = await createAssemblyConfig()
              setAssemblyConfs([...assemblyConfs, assemblyConf])
              setForm(clearFormFields)
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
              if (form.assemblyName) {
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
