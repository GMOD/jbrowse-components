import { useEffect, useState } from 'react'

import {
  Dialog,
  ErrorBanner,
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
  createOpenSequenceDialogModel,
  destroyOpenSequenceDialogModel,
} from './openSequenceDialogModel.ts'
import { adapterLabels, adapterTypes } from './util.ts'

import type { OpenSequenceDialogModel } from './openSequenceDialogModel.ts'
import type { AdapterType } from './util.ts'

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

const FastaAdapterInput = observer(function FastaAdapterInput({
  form,
}: {
  form: OpenSequenceDialogModel
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
        setLocation={form.setPrimaryFile}
      />
    </>
  )
})

const IndexedFastaAdapterInput = observer(function IndexedFastaAdapterInput({
  form,
}: {
  form: OpenSequenceDialogModel
}) {
  return (
    <>
      <FileSelector
        inline
        name="FASTA file"
        location={form.fastaLocation}
        setLocation={form.setPrimaryFile}
      />
      <FileSelector
        inline
        name="FASTA index (.fai) file"
        location={form.faiLocation}
        setLocation={form.setFaiLocation}
      />
    </>
  )
})

const BgzipFastaAdapterInput = observer(function BgzipFastaAdapterInput({
  form,
}: {
  form: OpenSequenceDialogModel
}) {
  return (
    <>
      <FileSelector
        inline
        name="FASTA file (.fa.gz)"
        location={form.fastaLocation}
        setLocation={form.setPrimaryFile}
      />
      <FileSelector
        inline
        name="FASTA index (.fai) file"
        location={form.faiLocation}
        setLocation={form.setFaiLocation}
      />
      <FileSelector
        inline
        name="FASTA gzip index (.gzi) file"
        location={form.gziLocation}
        setLocation={form.setGziLocation}
      />
    </>
  )
})

const TwoBitAdapterInput = observer(function TwoBitAdapterInput({
  form,
}: {
  form: OpenSequenceDialogModel
}) {
  return (
    <>
      <FileSelector
        inline
        name="2bit file"
        location={form.twoBitLocation}
        setLocation={form.setTwoBitFile}
      />
      <FileSelector
        inline
        name=".chrom.sizes (optional, can speed up loading 2bit files with many contigs)"
        location={form.chromSizesLocation}
        setLocation={form.setChromSizesLocation}
      />
    </>
  )
})

const AdvancedOptions = observer(function AdvancedOptions({
  form,
}: {
  form: OpenSequenceDialogModel
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
          form.setAssemblyDisplayName(event.target.value)
        }}
      />
      <FileSelector
        inline
        name="Add refName aliases e.g. remap chr1 and 1 to same entity. Can use a tab separated file of aliases, such as a .chromAliases files from UCSC"
        location={form.refNameAliasesLocation}
        setLocation={form.setRefNameAliasesLocation}
      />
      <FileSelector
        inline
        name="Add cytobands for assembly with the format of cytoBands.txt/cytoBandIdeo.txt from UCSC (.gz also allowed)"
        location={form.cytobandsLocation}
        setLocation={form.setCytobandsLocation}
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
  const [form] = useState(() => createOpenSequenceDialogModel())
  useEffect(() => () => destroyOpenSequenceDialogModel(form), [form])

  type AssemblyConf = Awaited<ReturnType<typeof createAssemblyConfig>>

  const [assemblyConfs, setAssemblyConfs] = useState<AssemblyConf[]>([])
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  async function createAssemblyConfig() {
    const raw = form.adapterConfig
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
      ...form.baseAssemblyConfig,
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `${form.assemblyName}-${Date.now()}`,
        adapter,
      },
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

        {error ? <ErrorBanner error={error} /> : null}

        <Paper className={classes.paper}>
          <TextField
            label="Assembly name"
            helperText="The assembly name e.g. hg38"
            variant="outlined"
            fullWidth
            value={form.assemblyName}
            onChange={event => {
              form.setAssemblyName(event.target.value)
            }}
          />

          <AdapterSelector
            adapterSelection={form.adapterSelection}
            setAdapterSelection={form.setAdapterSelection}
          />

          {form.adapterSelection === 'FastaAdapter' ? (
            <FastaAdapterInput form={form} />
          ) : form.adapterSelection === 'IndexedFastaAdapter' ? (
            <IndexedFastaAdapterInput form={form} />
          ) : form.adapterSelection === 'BgzipFastaAdapter' ? (
            <BgzipFastaAdapterInput form={form} />
          ) : (
            <TwoBitAdapterInput form={form} />
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
          {showAdvanced ? <AdvancedOptions form={form} /> : null}
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
              form.clearFormState()
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
