import { MenuItem, Paper, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { useSlotEditorStyles } from './useSlotEditorStyles.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TypeSelector = observer(function TypeSelector({
  typeNameChoices,
  slot,
  slotName,
  onChange,
}: {
  typeNameChoices: string[]
  // undefined for an optional sub-schema (e.g. textSearchAdapter) with no
  // type picked yet
  slot: AnyConfigurationModel | undefined
  slotName: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const { classes } = useSlotEditorStyles()
  return (
    <Paper className={classes.paper}>
      <div className={classes.paperContent}>
        <TextField
          value={slot?.type ?? ''}
          label={`Type of ${slotName}`}
          select
          variant="outlined"
          fullWidth
          onChange={onChange}
        >
          {typeNameChoices.map(str => (
            <MenuItem key={str} value={str}>
              {str}
            </MenuItem>
          ))}
        </TextField>
      </div>
    </Paper>
  )
})

export default TypeSelector
