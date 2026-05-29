import { useState } from 'react'

import {
  Dialog,
  ErrorMessage,
  FileSelector,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { fileToLocation } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
} from '@mui/material'
import { observer } from 'mobx-react'
import { useDropzone } from 'react-dropzone'

import {
  adapterLabels,
  adapterTypes,
  applyClassifiedFiles,
  applyPrimaryFile,
  applyTwoBitFile,
  classifyFilename,
  clearFormFields,
  getAdapterConfig,
  getBaseAssemblyConfig,
  getFilename,
  initialFormState,
  isBlank,
  urlTextToLocations,
} from './util.ts'

import type { AdapterType, AssemblyConf, FormState } from './util.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  advancedButton: {
    marginTop: theme.spacing(1),
  },
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
  modeToggle: {
    marginBottom: theme.spacing(1),
  },
  dropZone: {
    textAlign: 'center',
    padding: theme.spacing(3),
    borderWidth: 2,
    borderRadius: 4,
    borderStyle: 'dashed',
    cursor: 'pointer',
    display: 'block',
    transition: 'border .24s ease-in-out, background-color .24s ease-in-out',
  },
  dropZoneActive: {
    borderColor: theme.palette.secondary.light,
    backgroundColor: alpha(
      theme.palette.text.primary,
      theme.palette.action.hoverOpacity,
    ),
  },
  dropZoneInactive: {
    borderColor: theme.palette.divider,
    backgroundColor: theme.palette.background.default,
  },
  uploadIcon: {
    color: theme.palette.text.secondary,
  },
  detected: {
    marginTop: theme.spacing(2),
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

function DropArea({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { classes, cx } = useStyles()
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => {
      onFiles(files)
    },
  })
  return (
    <div
      {...getRootProps({
        className: cx(
          classes.dropZone,
          isDragActive ? classes.dropZoneActive : classes.dropZoneInactive,
        ),
      })}
    >
      <input {...getInputProps()} />
      <CloudUploadIcon className={classes.uploadIcon} fontSize="large" />
      <Typography color="text.secondary">
        Drag and drop genome files here, or click to browse
      </Typography>
    </div>
  )
}

const BulkForm = observer(function BulkForm({
  form,
  setForm,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
}) {
  const { classes } = useStyles()
  const [dropped, setDropped] = useState<FileLocation[]>([])
  const [urls, setUrls] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  const reclassify = (next: FileLocation[], nextUrls: string) => {
    setForm(f =>
      applyClassifiedFiles(
        f,
        [...next, ...urlTextToLocations(nextUrls)],
        nameTouched,
      ),
    )
  }

  const all = [...dropped, ...urlTextToLocations(urls)]
  const unrecognized = all.filter(
    loc => classifyFilename(getFilename(loc)) === undefined,
  )
  const detected = [
    { label: 'Sequence (FASTA)', loc: form.fastaLocation },
    { label: 'Sequence (2bit)', loc: form.twoBitLocation },
    { label: 'FASTA index (.fai)', loc: form.faiLocation },
    { label: 'Gzip index (.gzi)', loc: form.gziLocation },
    { label: 'Chrom sizes', loc: form.chromSizesLocation },
    { label: 'refName aliases', loc: form.refNameAliasesLocation },
    { label: 'Cytobands', loc: form.cytobandsLocation },
  ].filter(d => !isBlank(d.loc))

  return (
    <>
      <TextField
        label="Assembly name"
        helperText="The assembly name e.g. hg38"
        variant="outlined"
        fullWidth
        value={form.assemblyName}
        onChange={event => {
          setNameTouched(true)
          const { value } = event.target
          setForm(f => ({ ...f, assemblyName: value }))
        }}
      />
      <Box className={classes.detected}>
        <DropArea
          onFiles={files => {
            const next = [...dropped, ...files.map(file => fileToLocation(file))]
            setDropped(next)
            reclassify(next, urls)
          }}
        />
      </Box>
      <TextField
        className={classes.detected}
        label="...or paste file URLs (one per line)"
        placeholder={
          'https://example.com/hg38.fa.gz\nhttps://example.com/hg38.fa.gz.fai'
        }
        multiline
        minRows={3}
        fullWidth
        value={urls}
        onChange={event => {
          const { value } = event.target
          setUrls(value)
          reclassify(dropped, value)
        }}
      />
      {detected.length ? (
        <Box className={classes.detected}>
          <Typography variant="subtitle2">
            Detected ({adapterLabels[form.adapterSelection]}):
          </Typography>
          {detected.map(d => (
            <Typography key={d.label} variant="body2">
              {d.label}: {getFilename(d.loc)}
            </Typography>
          ))}
        </Box>
      ) : null}
      {unrecognized.length ? (
        <Alert severity="warning" className={classes.detected}>
          Could not classify: {unrecognized.map(loc => getFilename(loc)).join(', ')}
        </Alert>
      ) : null}
      {all.length ? (
        <Button
          size="small"
          onClick={() => {
            setDropped([])
            setUrls('')
            setNameTouched(false)
            setForm(f => applyClassifiedFiles(f, [], false))
          }}
        >
          Clear
        </Button>
      ) : null}
    </>
  )
})

const OpenSequenceDialog = observer(function OpenSequenceDialog({
  onClose,
}: {
  onClose: (conf?: AssemblyConf[]) => Promise<void>
}) {
  const { classes } = useStyles()
  const [form, setForm] = useState(initialFormState)
  const [assemblyConfs, setAssemblyConfs] = useState<AssemblyConf[]>([])
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mode, setMode] = useState<'guided' | 'bulk'>('guided')

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

  async function stageCurrentAssembly() {
    if (!form.assemblyName) {
      throw new Error('No assembly name set')
    }
    if (assemblyConfs.some(conf => conf.name === form.assemblyName)) {
      throw new Error(`Assembly "${form.assemblyName}" is already staged`)
    }
    return [...assemblyConfs, await createAssemblyConfig()]
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
          <ToggleButtonGroup
            className={classes.modeToggle}
            size="small"
            exclusive
            value={mode}
            onChange={(_event, value: 'guided' | 'bulk' | null) => {
              if (value) {
                setMode(value)
              }
            }}
          >
            <ToggleButton value="guided">Guided</ToggleButton>
            <ToggleButton value="bulk">Drop / paste files</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'bulk' ? (
            <BulkForm form={form} setForm={setForm} />
          ) : (
            <>
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
                variant="text"
                size="small"
                className={classes.advancedButton}
                startIcon={
                  showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />
                }
                onClick={() => {
                  setShowAdvanced(a => !a)
                }}
              >
                Advanced options
              </Button>
              {showAdvanced ? (
                <AdvancedOptions
                  form={form}
                  setAssemblyDisplayName={setAssemblyDisplayName}
                  setRefNameAliasesLocation={setRefNameAliasesLocation}
                  setCytobandsLocation={setCytobandsLocation}
                />
              ) : null}
            </>
          )}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onClose().catch((e: unknown) => {
              setError(e)
            })
          }}
          color="secondary"
          disabled={!!loading}
        >
          Cancel
        </Button>
        <Button
          onClick={async () => {
            try {
              setError(undefined)
              setAssemblyConfs(await stageCurrentAssembly())
              setForm(clearFormFields)
            } catch (e) {
              setError(e)
              console.error(e)
            } finally {
              setLoading('')
            }
          }}
          disabled={!!loading}
          variant="outlined"
        >
          Add another assembly
        </Button>
        <Button
          data-testid="open-sequence-submit"
          onClick={async () => {
            try {
              setError(undefined)
              const confs = form.assemblyName
                ? await stageCurrentAssembly()
                : assemblyConfs
              if (!confs.length) {
                throw new Error('No assemblies specified')
              }
              setAssemblyConfs(confs)
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
          Open
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default OpenSequenceDialog
