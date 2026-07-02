import { FileSelector } from '@jbrowse/core/ui'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { FormState } from '@jbrowse/core/util/assemblyConfigUtils'
import type { FileLocation } from '@jbrowse/core/util/types'

// Display name plus the optional refName-aliases and cytobands files. Shared by
// the guided form and the wizard's confirm step; kept behind an expander in both
// so it never adds to the up-front load.
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
        name="Add refName aliases e.g. remap chr1 and 1 to same entity. Can use a tab separated file of aliases, such as a .chromAliases files from UCSC"
        location={form.refNameAliasesLocation}
        setLocation={(loc: FileLocation) => {
          setRefNameAliasesLocation(loc)
        }}
      />
      <FileSelector
        inline
        name="Add cytobands for assembly with the format of cytoBands.txt/cytoBandIdeo.txt from UCSC (.gz also allowed)"
        location={form.cytobandsLocation}
        setLocation={(loc: FileLocation) => {
          setCytobandsLocation(loc)
        }}
      />
    </>
  )
})

export default AdvancedOptions
