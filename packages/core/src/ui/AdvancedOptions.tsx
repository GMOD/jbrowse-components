import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import FileSelector from './FileSelector/FileSelector.tsx'

import type { FormState } from '../util/assemblyConfigUtils.ts'
import type { FileLocation } from '../util/types/index.ts'

// Display name plus the optional refName-aliases and cytobands files. Shared by
// every add-assembly surface (desktop Open genome dialog, in-app Assembly
// manager) behind a "More options" expander so it never adds to the up-front
// load.
const AdvancedOptions = observer(function AdvancedOptions({
  form,
  setForm,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
}) {
  const setField =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setForm(f => ({ ...f, [key]: value }))
    }
  const setRefNameAliasesLocation = setField('refNameAliasesLocation')
  const setCytobandsLocation = setField('cytobandsLocation')
  return (
    <>
      <TextField
        label="Assembly display name"
        helperText='(optional) A human readable display name e.g. "Homo sapiens (hg38)"'
        variant="outlined"
        fullWidth
        value={form.assemblyDisplayName}
        onChange={event => {
          const { value } = event.target
          setForm(f => ({ ...f, assemblyDisplayName: value }))
        }}
      />
      <FileSelector
        inline
        name="refName aliases"
        description="Remap equivalent refNames (e.g. chr1 and 1). Tab-separated file such as a UCSC .chromAliases file."
        location={form.refNameAliasesLocation}
        setLocation={(loc: FileLocation) => {
          setRefNameAliasesLocation(loc)
        }}
      />
      <FileSelector
        inline
        name="Cytobands"
        description="UCSC cytoBand.txt / cytoBandIdeo.txt format (.gz allowed)."
        location={form.cytobandsLocation}
        setLocation={(loc: FileLocation) => {
          setCytobandsLocation(loc)
        }}
      />
    </>
  )
})

export default AdvancedOptions
