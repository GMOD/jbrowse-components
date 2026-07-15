import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
} from '@mui/material'
import { observer } from 'mobx-react'

const BooleanEditor = observer(function BooleanEditor({
  slot,
}: {
  slot: {
    name: string
    // maybeBoolean slots start undefined (the promotable "inherit" state); the
    // checkbox coerces to a concrete boolean so it stays controlled
    value: boolean | undefined
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
            checked={!!slot.value}
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
