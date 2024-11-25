import React from 'react'
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
} from '@mui/material'
import { observer } from 'mobx-react'

const BooleanEditor = observer(function ({
  slot,
}: {
  slot: {
    name: string
    value: boolean
    set: (arg: boolean) => void
    description: string
  }
}) {
  return (
    <FormControl>
      <FormControlLabel
        label={slot.name}
        control={
          <Checkbox
            checked={slot.value}
            onChange={evt => {
              slot.set(evt.target.checked)
            }}
          />
        }
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </FormControl>
  )
})

export default BooleanEditor
