import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import MonospaceTextField from './MonospaceTextField.tsx'

const useStyles = makeStyles()(theme => ({
  jsonEditor: {
    fontSize: '12px',
    background: theme.palette.background.default,
    width: '100%',
    marginTop: '16px',
    border: '1px solid rgba(0,0,0,0.42)',
  },
}))

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
  const [contents, setContents] = useState(JSON.stringify(slot.value, null, 2))
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
