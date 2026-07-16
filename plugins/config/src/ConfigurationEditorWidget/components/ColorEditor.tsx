import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import ConfigurationTextField from './ConfigurationTextField.tsx'

const PopoverPicker = lazy(() => import('@jbrowse/core/ui/PopoverPicker'))

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  field: {
    flex: 1,
    minWidth: 0,
  },
})

// Also drives `maybeColor`, whose value is `undefined` while unset. An empty
// string keeps the field controlled and the picker fed, the same way
// NumberEditor renders an unset `maybeNumber` as an empty field. Clearing the
// field writes `''` rather than restoring `undefined` — "unset" is reachable
// through the slot's reset button, which is where every other slot type puts it.
const ColorEditor = observer(function ColorEditor(props: {
  slot: {
    name: string
    value: string | undefined
    description: string
    set: (arg: string) => void
  }
}) {
  const { slot } = props
  const { classes } = useStyles()
  const value = slot.value ?? ''
  return (
    <div className={classes.root}>
      <ConfigurationTextField
        value={value}
        label={slot.name}
        helperText={slot.description}
        className={classes.field}
        onChange={event => {
          slot.set(event.target.value)
        }}
      />
      <Suspense fallback={null}>
        <PopoverPicker
          color={value}
          onChange={color => {
            slot.set(color)
          }}
        />
      </Suspense>
    </div>
  )
})

export default ColorEditor
