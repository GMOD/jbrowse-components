import React from 'react'
import { TextField, MenuItem, withStyles, Paper } from '@material-ui/core'
import { observer } from 'mobx-react'
import { slotEditorStyles } from './SlotEditor'

const TypeSelector = withStyles(slotEditorStyles)(
  observer(({ typeNameChoices, slot, slotName, onChange, classes }) => (
    <Paper className={classes.paper}>
      <div className={classes.paperContent}>
        <TextField
          value={slot.type}
          label="Type"
          select
          // error={filterError}
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
  )),
)

export default TypeSelector
