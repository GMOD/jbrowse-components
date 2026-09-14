import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { FeatureGroupBy } from '../groupBy.ts'

const GroupByAttributeDialog = observer(function GroupByAttributeDialog({
  model,
  handleClose,
  initialAttribute = '',
}: {
  model: { setGroupBy: (groupBy?: FeatureGroupBy) => void }
  handleClose: () => void
  initialAttribute?: string
}) {
  const [attribute, setAttribute] = useState(initialAttribute)
  const trimmed = attribute.trim()
  return (
    <SubmitDialog
      open
      title="Group by attribute"
      submitText="Apply"
      submitDisabled={!trimmed}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        model.setGroupBy({ type: 'attribute', attribute: trimmed })
        handleClose()
      }}
    >
      <Typography variant="body2" gutterBottom>
        Each unique value of the chosen feature attribute becomes its own
        labelled section, with features carrying no value last. Common
        attributes: type, source, biotype, gene_biotype.
      </Typography>
      <TextField
        label="Attribute name"
        value={attribute}
        onChange={event => {
          setAttribute(event.target.value)
        }}
        placeholder="e.g. biotype"
        fullWidth
      />
    </SubmitDialog>
  )
})

export default GroupByAttributeDialog
