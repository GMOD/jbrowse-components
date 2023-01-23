import React from 'react'
import { observer } from 'mobx-react'

import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
} from '@mui/material'

export default observer(function ({
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
            onChange={evt => slot.set(evt.target.checked)}
          />
        }
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </FormControl>
  )
})
