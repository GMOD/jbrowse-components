import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  RecordFieldAutocomplete,
  useRecordFieldChoices,
} from './RecordFieldAutocomplete.tsx'

/** Picks the record field whose values each stack the records in a section. */
const RecordsFacetFieldDialog = observer(function RecordsFacetFieldDialog({
  model,
  handleClose,
}: {
  model: {
    id: string
    recordsFacet: { field: string } | undefined
    fetchAdapterMetadata: () => Promise<unknown>
    recordsFacetByField: (field: string) => void
  }
  handleClose: () => void
}) {
  const choices = useRecordFieldChoices(model)
  const [ref, setRef] = useState(model.recordsFacet?.field ?? '')
  const trimmed = ref.trim()
  return (
    <SubmitDialog
      open
      title="Group records by field"
      submitText="Apply"
      submitDisabled={!trimmed}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        model.recordsFacetByField(trimmed)
        handleClose()
      }}
    >
      <Typography variant="body2" gutterBottom>
        Each value of the field stacks its records in a labelled section.
      </Typography>
      <RecordFieldAutocomplete
        choices={choices}
        value={ref}
        onChange={value => {
          setRef(value)
        }}
        helperText={choices.find(c => c.ref === trimmed)?.description}
        testId="records-facet-field"
      />
    </SubmitDialog>
  )
})

export default RecordsFacetFieldDialog
