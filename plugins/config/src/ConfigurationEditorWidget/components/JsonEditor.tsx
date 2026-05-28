import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { InputLabel, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { monospaceFontFamily as fontFamily } from './useSlotEditorStyles.ts'

const fontSize = '12px'

const useStyles = makeStyles()(theme => ({
  error: {
    color: 'red',
    fontSize: '0.8em',
  },
  jsonEditor: {
    fontFamily,
    fontSize,
    background: theme.palette.background.default,
    width: '100%',
    marginTop: '16px',
    border: '1px solid rgba(0,0,0,0.42)',
  },
  jsonContainer: {
    width: '100%',
    overflowX: 'auto',
  },
  textAreaFont: {
    fontFamily,
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

  let error: unknown
  try {
    JSON.parse(contents)
  } catch (e) {
    error = e
  }

  return (
    <>
      {error ? <p className={classes.error}>{`${error}`}</p> : null}
      <div className={classes.jsonContainer}>
        <InputLabel shrink htmlFor="json-editor">
          {slot.name}
        </InputLabel>
        <TextField
          id="json-editor"
          className={classes.jsonEditor}
          value={contents}
          helperText={slot.description}
          multiline
          onChange={event => {
            const val = event.target.value
            setContents(val)
            try {
              slot.set(JSON.parse(val))
            } catch {
              // invalid JSON, error displayed via computed error above
            }
          }}
          style={{ background: error ? '#fdd' : undefined }}
          slotProps={{
            input: {
              classes: {
                input: classes.textAreaFont,
              },
            },
          }}
        />
      </div>
    </>
  )
})

export default JsonEditor
