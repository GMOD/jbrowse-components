import { LabeledCheckbox } from '@jbrowse/core/ui'
import { FormControl, FormHelperText } from '@mui/material'
import { observer } from 'mobx-react'

/** #slotEditor checkbox */
const BooleanEditor = observer(function BooleanEditor({
  slot,
}: {
  slot: {
    name: string
    // a `maybeBoolean` slot is undefined when unset; the checkbox coerces to a
    // concrete boolean so it stays controlled
    value: boolean | undefined
    set: (arg: boolean) => void
    description: string
  }
}) {
  return (
    <FormControl>
      <LabeledCheckbox
        label={slot.name}
        checked={!!slot.value}
        onChange={val => {
          slot.set(val)
        }}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </FormControl>
  )
})

export default BooleanEditor
