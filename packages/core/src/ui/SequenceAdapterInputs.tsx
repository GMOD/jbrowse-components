import { Alert, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import {
  adapterLabels,
  adapterTypes,
  makeSetField,
  sidecars,
} from '../util/assemblyConfigUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'
import FileSelector from './FileSelector/FileSelector.tsx'

import type {
  AdapterType,
  FormState,
  LocationField,
} from '../util/assemblyConfigUtils.ts'
import type { AbstractRootModel, FileLocation } from '../util/types/index.ts'

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
        const selected = adapterTypes.find(type => type === event.target.value)
        if (selected) {
          setAdapterSelection(selected)
        }
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

interface FileInput {
  field: LocationField
  name: string
  description?: string
}

const fileInputs: Record<AdapterType, FileInput[]> = {
  FastaAdapter: [{ field: 'fastaLocation', name: 'FASTA file' }],
  IndexedFastaAdapter: [
    { field: 'fastaLocation', name: 'FASTA file' },
    { field: 'faiLocation', name: sidecars.fai.label },
  ],
  BgzipFastaAdapter: [
    { field: 'fastaLocation', name: 'FASTA file (.fa.gz)' },
    { field: 'faiLocation', name: sidecars.fai.label },
    { field: 'gziLocation', name: sidecars.gzi.label },
  ],
  TwoBitAdapter: [
    { field: 'twoBitLocation', name: '2bit file' },
    {
      field: 'chromSizesLocation',
      name: '.chrom.sizes (optional)',
      description: 'Can speed up loading 2bit files with many contigs.',
    },
  ],
  ChromSizesAdapter: [
    {
      field: 'chromSizesLocation',
      name: '.chrom.sizes file',
      description:
        'One name<TAB>length line per reference sequence. The assembly gets its names and lengths from this and carries no sequence.',
    },
  ],
}

// The per-adapter file selectors (FASTA/.fai/.gzi/2bit/.chrom.sizes) driven by
// the chosen format. Shared by the jbrowse-desktop Open genome(s) guided form
// and the in-app Assembly manager add form. The primary-file setters are passed
// in so each surface controls how picking a file updates state (e.g. desktop's
// applyPrimaryFile auto-detects the adapter and prefills sidecars).
const SequenceAdapterInputs = observer(function SequenceAdapterInputs({
  form,
  setForm,
  rootModel,
  setPrimaryFile,
  setTwoBitFile,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  rootModel: AbstractRootModel | undefined
  setPrimaryFile: (location: FileLocation) => void
  setTwoBitFile: (location: FileLocation) => void
}) {
  const { classes } = useStyles()
  const setField = makeSetField(setForm)
  const { adapterSelection } = form
  const setterFor = (field: LocationField) =>
    field === 'fastaLocation'
      ? setPrimaryFile
      : field === 'twoBitLocation'
        ? setTwoBitFile
        : setField(field)
  return (
    <>
      <AdapterTypeSelector
        adapterSelection={adapterSelection}
        setAdapterSelection={setField('adapterSelection')}
      />
      {adapterSelection === 'FastaAdapter' ? (
        <Alert severity="warning" className={classes.fastaWarning}>
          Note: a FASTA index will be generated automatically. For large
          genomes, providing a pre-made .fai (choose "FASTA with index") is
          faster, and a remote file may be downloaded in full.
        </Alert>
      ) : null}
      {fileInputs[adapterSelection].map(({ field, name, description }) => (
        <FileSelector
          key={field}
          inline
          name={name}
          description={description}
          rootModel={rootModel}
          location={form[field]}
          setLocation={setterFor(field)}
        />
      ))}
    </>
  )
})

export default SequenceAdapterInputs
