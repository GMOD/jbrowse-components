import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import AttributeFieldInput from './AttributeFieldInput.tsx'
import { COLORING } from './attributeVerdict.ts'

import type { AttributeScanModel } from './AttributeFieldInput.tsx'
import type { Plot } from '@jbrowse/core/configuration'

const ColorByAttributeDialog = observer(function ColorByAttributeDialog({
  model,
  handleClose,
}: {
  model: AttributeScanModel & {
    colorByAttribute: string
    colorByField: (field: string) => void
    openPlotDialog: (seed?: Plot) => void
  }
  handleClose: () => void
}) {
  const [attribute, setAttribute] = useState(model.colorByAttribute)
  const trimmed = attribute.trim()

  return (
    <SubmitDialog
      open
      title="Color by attribute"
      submitText="Apply"
      submitDisabled={!trimmed}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        model.colorByField(trimmed)
        handleClose()
      }}
      actions={
        <Button
          onClick={() => {
            model.openPlotDialog(
              trimmed && trimmed !== model.colorByAttribute
                ? { color: { field: trimmed } }
                : undefined,
            )
            handleClose()
          }}
        >
          Edit plot...
        </Button>
      }
    >
      <Typography variant="body2" gutterBottom>
        Each value of the attribute paints one palette color, and the track
        draws a key saying which.
      </Typography>
      <AttributeFieldInput
        model={model}
        value={attribute}
        onChange={setAttribute}
        use={COLORING}
        testid="color-by-attribute"
        placeholder="e.g. gene_biotype"
      />
    </SubmitDialog>
  )
})

export default ColorByAttributeDialog
