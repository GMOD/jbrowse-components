import { useState } from 'react'

import { MonospaceTextField } from '@jbrowse/core/ui'
import { alpha } from '@jbrowse/core/ui/palette'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

const useStyles = makeStyles()(theme => ({
  jsonEditor: {
    fontSize: '12px',
    background: theme.palette.background.default,
    width: '100%',
    marginTop: '16px',
    border: `1px solid ${alpha(theme.palette.text.primary, 0.42)}`,
  },
}))

function printJson(value: unknown) {
  return value === undefined ? '' : JSON.stringify(value, null, 2)
}

// The text is a draft while focused, and an unparsed one stays until it
// parses, so leaving the field never drops what was typed.
/** #slotEditor monospace textarea holding arbitrary JSON */
const JsonEditor = observer(function JsonEditor({
  slot,
}: {
  slot: {
    name: string
    description: string
    value: unknown
    set: (arg: unknown) => void
  }
}) {
  const { classes } = useStyles()
  const [draft, setDraft] = useState<string>()
  const [error, setError] = useState<unknown>()
  return (
    <MonospaceTextField
      className={classes.jsonEditor}
      label={slot.name}
      value={draft ?? printJson(slot.value)}
      error={error}
      helperText={slot.description}
      onChange={val => {
        setDraft(val)
        try {
          slot.set(JSON.parse(val))
          setError(undefined)
        } catch (e) {
          setError(e)
        }
      }}
      onBlur={() => {
        if (!error) {
          setDraft(undefined)
        }
      }}
    />
  )
})

export default JsonEditor
