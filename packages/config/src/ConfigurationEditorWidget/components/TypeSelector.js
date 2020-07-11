import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import TextField from '@material-ui/core/TextField'
import { observer } from 'mobx-react'
import React from 'react'
import { useSlotEditorStyles } from './SlotEditor'

const TypeSelector = observer(
  ({ typeNameChoices, slot, slotName, onChange }) => {
    const classes = useSlotEditorStyles()
    return (
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
    )
  },
)

export default TypeSelector
