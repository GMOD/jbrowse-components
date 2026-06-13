import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const ColorByAttributeDialog = observer(function ColorByAttributeDialog({
  model,
  handleClose,
  initialAttribute = '',
}: {
  model: {
    setFeatureColor: (arg?: string) => void
  }
  handleClose: () => void
  initialAttribute?: string
}) {
  const [attribute, setAttribute] = useState(initialAttribute)
  const trimmed = attribute.trim()
  const expression = trimmed
    ? `jexl:randomColor(get(feature,'${trimmed}'))`
    : ''

  return (
    <Dialog
      open
      onClose={() => {
        handleClose()
      }}
      title="Color by attribute"
    >
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          Each unique value of the chosen feature attribute receives a distinct
          color. Common attributes: type, source, biotype, gene_id.
        </Typography>
        <TextField
          label="Attribute name"
          value={attribute}
          onChange={event => {
            setAttribute(event.target.value)
          }}
          placeholder="e.g. type"
          fullWidth
          helperText={expression ? `Expression: ${expression}` : undefined}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          disabled={!trimmed}
          onClick={() => {
            model.setFeatureColor(expression)
            handleClose()
          }}
        >
          Apply
        </Button>
        <Button
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ColorByAttributeDialog
