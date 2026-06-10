import { Suspense, lazy } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

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

const ColorEditor = observer(function ColorEditor(props: {
  slot: {
    name: string
    value: string
    description: string
    set: (arg: string) => void
  }
}) {
  const { slot } = props
  const { classes } = useStyles()
  return (
    <div className={classes.root}>
      <TextField
        value={slot.value}
        label={slot.name}
        helperText={slot.description}
        className={classes.field}
        onChange={event => {
          slot.set(event.target.value)
        }}
      />
      <Suspense fallback={null}>
        <PopoverPicker
          color={slot.value}
          onChange={color => {
            slot.set(color)
          }}
        />
      </Suspense>
    </div>
  )
})

export default ColorEditor
