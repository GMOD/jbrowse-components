import { useState } from 'react'

import { MonospaceTextField } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  jsonEditor: {
    fontSize: '12px',
    background: theme.palette.background.default,
    width: '100%',
    marginTop: '16px',
    border: '1px solid rgba(0,0,0,0.42)',
  },
}))

/** #slotEditor monospace textarea holding arbitrary JSON */
const JsonEditor = observer(function JsonEditor({
  slot,
}: {
  slot: {
    name: string
    description: string
    value: unknown
    // what unset resolves to on a promotable slot, absent on a plain one
    promotedBase?: unknown
    set: (arg: unknown) => void
  }
}) {
  const { classes } = useStyles()
  // A `maybeFrozen` slot is `undefined` when unset — the promotable inherit
  // state (alignments/synteny `colorBy`). `JSON.stringify(undefined)` returns
  // the *value* `undefined`, not a string, so seeding straight off `slot.value`
  // handed MonospaceTextField an undefined `value` and made the field
  // uncontrolled until the first keystroke (React then warns on the switch).
  // Show what unset resolves to instead, as BooleanEditor does.
  const [contents, setContents] = useState(() => {
    const shown = slot.value ?? slot.promotedBase
    return shown === undefined ? '' : JSON.stringify(shown, null, 2)
  })
  const [error, setError] = useState<unknown>()

  return (
    <MonospaceTextField
      className={classes.jsonEditor}
      label={slot.name}
      value={contents}
      error={error}
      helperText={slot.description}
      onChange={val => {
        setContents(val)
        try {
          slot.set(JSON.parse(val))
          setError(undefined)
        } catch (e) {
          setError(e)
        }
      }}
    />
  )
})

export default JsonEditor
