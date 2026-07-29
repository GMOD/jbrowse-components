import { useState } from 'react'

import { ErrorMessage, SubmitDialog } from '@jbrowse/core/ui'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { TextField, Typography } from '@mui/material'
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
    <SubmitDialog
      open
      title="Color by attribute"
      submitText="Apply"
      submitDisabled={!trimmed || !!error}
      onCancel={() => {
        handleClose()
      }}
      onSubmit={() => {
        model.setFeatureColor(expression)
        handleClose()
      }}
    >
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
    </SubmitDialog>
  )
})

export default ColorByAttributeDialog
