import { useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Alert, Button, MenuItem, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  adapterLabels,
  adapterTypes,
  applyPrimaryFile,
  applyTwoBitFile,
  formHasSequence,
} from './util.ts'

import type { AdapterType, FormState } from './util.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  advancedButton: {
    marginTop: theme.spacing(1),
  },
  fastaWarning: {
    margin: theme.spacing(1),
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
  const { classes } = useStyles()
  return (
    <>
      <Alert severity="warning" className={classes.fastaWarning}>
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

const GuidedForm = observer(function GuidedForm({
  form,
  setForm,
  loading,
  onStageAnother,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  loading: string
  onStageAnother: () => void
}) {
  const { classes } = useStyles()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const setField =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setForm(f => ({ ...f, [key]: value }))
    }
  const setPrimaryFile = (loc: FileLocation) => {
    setForm(f => applyPrimaryFile(f, loc))
  }
  const setTwoBitFile = (loc: FileLocation) => {
    setForm(f => applyTwoBitFile(f, loc))
  }
  const setFaiLocation = setField('faiLocation')
  const setGziLocation = setField('gziLocation')
  const setChromSizesLocation = setField('chromSizesLocation')
  const setRefNameAliasesLocation = setField('refNameAliasesLocation')
  const setCytobandsLocation = setField('cytobandsLocation')
  const setAssemblyDisplayName = setField('assemblyDisplayName')
  const setAdapterSelection = setField('adapterSelection')

  return (
    <>
      <TextField
        label="Assembly name"
        helperText="The assembly name e.g. hg38"
        variant="outlined"
        fullWidth
        value={form.assemblyName}
        onChange={event => {
          const { value } = event.target
          setForm(f => ({ ...f, assemblyName: value }))
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
        startIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => {
          setShowAdvanced(a => !a)
        }}
      >
        Advanced options
      </Button>
      {showAdvanced ? (
        <>
          <AdvancedOptions
            form={form}
            setAssemblyDisplayName={setAssemblyDisplayName}
            setRefNameAliasesLocation={setRefNameAliasesLocation}
            setCytobandsLocation={setCytobandsLocation}
          />
          <Button
            className={classes.advancedButton}
            variant="outlined"
            size="small"
            disabled={!!loading || !form.assemblyName || !formHasSequence(form)}
            onClick={() => {
              onStageAnother()
            }}
          >
            Stage this genome and add another
          </Button>
          <Typography variant="caption" component="div">
            Open multiple genomes at once. Staged genomes appear at the top and
            load together when you click Open.
          </Typography>
        </>
      ) : null}
    </>
  )
})

export default GuidedForm
