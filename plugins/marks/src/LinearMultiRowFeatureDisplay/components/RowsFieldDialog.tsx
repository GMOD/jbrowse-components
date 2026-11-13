import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import AttributeFieldInput from '@jbrowse/display-kit/AttributeFieldInput'
import { ROWS } from '@jbrowse/display-kit/attributeVerdict'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { AttributeScanModel } from '@jbrowse/display-kit/AttributeFieldInput'

/**
 * One row per's Attribute...: the attributes the features in view carry, each
 * with how many rows it would make, and the one picked is the rows field.
 */
const RowsFieldDialog = observer(function RowsFieldDialog({
  model,
  handleClose,
  onDismiss,
}: {
  model: AttributeScanModel & {
    rowsField: string
    setRowsField: (field: string) => void
  }
  handleClose: () => void
  onDismiss?: () => void
}) {
  const [attribute, setAttribute] = useState(model.rowsField)
  const trimmed = attribute.trim()
  return (
    <SubmitDialog
      open
      title="One row per attribute"
      submitText="Apply"
      submitDisabled={!trimmed}
      onCancel={() => {
        onDismiss?.()
        handleClose()
      }}
      onSubmit={() => {
        model.setRowsField(trimmed)
        handleClose()
      }}
    >
      <Typography variant="body2" gutterBottom>
        Each value of the attribute takes a row of its own, labelled in the
        sidebar, holding the features that carry it.
      </Typography>
      <AttributeFieldInput
        model={model}
        value={attribute}
        onChange={setAttribute}
        use={ROWS}
        testid="rows-by-attribute"
        placeholder="e.g. sample"
      />
    </SubmitDialog>
  )
})

export default RowsFieldDialog
