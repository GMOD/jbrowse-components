import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { Button, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { ChannelSpec } from '@jbrowse/display-kit/channelSpec'

const ColorByAttributeDialog = observer(function ColorByAttributeDialog({
  model,
  handleClose,
}: {
  model: {
    colorByAttribute: string
    colorByField: (field: string) => void
    openChannelSpecDialog: (seed?: ChannelSpec) => void
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
            model.openChannelSpecDialog(
              trimmed && trimmed !== model.colorByAttribute
                ? { color: { field: trimmed } }
                : undefined,
            )
            handleClose()
          }}
        >
          Edit as JSON...
        </Button>
      }
    >
      <Typography variant="body2" gutterBottom>
        Each value of the attribute paints one palette color, and the track
        draws a key saying which. Common attributes: type, source, biotype,
        gene_biotype.
      </Typography>
      <TextField
        label="Attribute name"
        value={attribute}
        onChange={event => {
          setAttribute(event.target.value)
        }}
        placeholder="e.g. gene_biotype"
        fullWidth
      />
    </SubmitDialog>
  )
})

export default ColorByAttributeDialog
