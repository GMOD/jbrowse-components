import React from 'react'
import {
  TextField,
  MenuItem,
  withStyles,
  Card,
  CardContent,
} from '@material-ui/core'
import { observer } from 'mobx-react'
import { slotEditorStyles } from './SlotEditor'

const TypeSelector = withStyles(slotEditorStyles)(
  observer(({ typeNameChoices, slot, slotName, onChange, classes }) => (
    <Card className={classes.card}>
      <CardContent className={classes.cardContent}>
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
      </CardContent>
    </Card>
  )),
)

export default TypeSelector
