import { Suspense, lazy, useState } from 'react'

import { isCssColor } from '@jbrowse/core/util/colorBits'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
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
// NumberEditor renders an unset `maybeNumber` as an empty field. The slot
// refuses what is not a color, so text that does not parse yet stays a draft
// in the field and reaches the slot once it does; leaving the field drops an
// unparsed draft. "Unset" is reachable through the slot's reset button, which
// is where every other slot type puts it.
/** #slotEditor text field beside a swatch that opens a color picker */
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
  const [draft, setDraft] = useState<string>()
  const value = slot.value ?? ''
  return (
    <div className={classes.root}>
      <ConfigurationTextField
        value={draft ?? value}
        label={slot.name}
        error={draft !== undefined}
        helperText={
          draft === undefined ? slot.description : `"${draft}" is not a color`
        }
        className={classes.field}
        onChange={event => {
          const text = event.target.value
          if (isCssColor(text) || isJexl(text)) {
            slot.set(text)
            setDraft(undefined)
          } else {
            setDraft(text)
          }
        }}
        onBlur={() => {
          setDraft(undefined)
        }}
      />
      <Suspense fallback={null}>
        <PopoverPicker
          color={value}
          onChange={color => {
            slot.set(color)
            setDraft(undefined)
          }}
        />
      </Suspense>
    </div>
  )
})

export default ColorEditor
