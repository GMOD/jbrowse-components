import { Alert, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import FileSelector from './FileSelector/FileSelector.tsx'
import {
  adapterLabels,
  adapterTypes,
  makeSetField,
} from '../util/assemblyConfigUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { AdapterType, FormState } from '../util/assemblyConfigUtils.ts'
import type { FileLocation } from '../util/types/index.ts'

const useStyles = makeStyles()(theme => ({
  fastaWarning: {
    margin: theme.spacing(1),
  },
}))

// The sequence "Format" dropdown, shared so every add-assembly surface offers
// the same friendly labels for the same adapter types.
const AdapterTypeSelector = observer(function AdapterTypeSelector({
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

// The per-adapter file selectors (FASTA/.fai/.gzi/2bit/.chrom.sizes) driven by
// the chosen format. Shared by the jbrowse-desktop Open genome(s) guided form
// and the in-app Assembly manager add form. The primary-file setters are passed
// in so each surface controls how picking a file updates state (e.g. desktop's
// applyPrimaryFile auto-detects the adapter and prefills sidecars).
const SequenceAdapterInputs = observer(function SequenceAdapterInputs({
  form,
  setForm,
  setPrimaryFile,
  setTwoBitFile,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  setPrimaryFile: (location: FileLocation) => void
  setTwoBitFile: (location: FileLocation) => void
}) {
  const { classes } = useStyles()
  const setField = makeSetField(setForm)
  const { adapterSelection } = form
  return (
    <>
      <AdapterTypeSelector
        adapterSelection={adapterSelection}
        setAdapterSelection={setField('adapterSelection')}
      />

      {adapterSelection === 'FastaAdapter' ? (
        <>
          <Alert severity="warning" className={classes.fastaWarning}>
            Note: a FASTA index will be generated automatically. For large
            genomes, providing a pre-made .fai (choose "FASTA with index") is
            faster, and a remote file may be downloaded in full.
          </Alert>
          <FileSelector
            inline
            name="FASTA file"
            location={form.fastaLocation}
            setLocation={setPrimaryFile}
          />
        </>
      ) : adapterSelection === 'IndexedFastaAdapter' ? (
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
            setLocation={setField('faiLocation')}
          />
        </>
      ) : adapterSelection === 'BgzipFastaAdapter' ? (
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
            setLocation={setField('faiLocation')}
          />
          <FileSelector
            inline
            name="FASTA gzip index (.gzi) file"
            location={form.gziLocation}
            setLocation={setField('gziLocation')}
          />
        </>
      ) : (
        <>
          <FileSelector
            inline
            name="2bit file"
            location={form.twoBitLocation}
            setLocation={setTwoBitFile}
          />
          <FileSelector
            inline
            name=".chrom.sizes (optional)"
            description="Can speed up loading 2bit files with many contigs."
            location={form.chromSizesLocation}
            setLocation={setField('chromSizesLocation')}
          />
        </>
      )}
    </>
  )
})

export default SequenceAdapterInputs
