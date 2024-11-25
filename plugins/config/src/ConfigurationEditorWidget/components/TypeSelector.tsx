import React from 'react'
import { MenuItem, Paper, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { useSlotEditorStyles } from './useSlotEditorStyles'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const TypeSelector = observer(function ({
  typeNameChoices,
  slot,
  slotName,
  onChange,
}: {
  typeNameChoices: string[]
  slot: AnyConfigurationModel
  slotName: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const { classes } = useSlotEditorStyles()
  return (
    <Paper className={classes.paper}>
      <div className={classes.paperContent}>
        <TextField
          value={slot.type}
          label="Type"
          select
          helperText={`Type of ${slotName} to use`}
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
