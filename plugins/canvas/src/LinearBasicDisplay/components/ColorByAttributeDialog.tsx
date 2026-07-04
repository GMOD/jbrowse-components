import { useState } from 'react'

import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { getEnv } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// jexl compile error for the generated expression, or undefined when it parses.
// An attribute name containing a quote or backslash produces a malformed
// expression, so this gates Apply rather than committing a broken jexl string.
function jexlError(expression: string, jexl: JexlInstance) {
  try {
    stringToJexlExpression(expression, jexl)
    return undefined
  } catch (e) {
    return e
  }
}

const ColorByAttributeDialog = observer(function ColorByAttributeDialog({
  model,
  handleClose,
  initialAttribute = '',
}: {
  model: IAnyStateTreeNode & {
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
  const jexl = getEnv<{ pluginManager: PluginManager }>(model).pluginManager
    .jexl
  const error = expression ? jexlError(expression, jexl) : undefined

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
        {error ? <ErrorMessage error={error} /> : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          disabled={!trimmed || !!error}
          onClick={() => {
            model.setFeatureColor(expression)
            handleClose()
          }}
        >
          Apply
        </Button>
        <Button
          variant="contained"
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
