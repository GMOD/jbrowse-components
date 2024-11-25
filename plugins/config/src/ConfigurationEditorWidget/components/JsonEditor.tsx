import React, { useEffect, useState } from 'react'
import { InputLabel, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// fontSize and fontFamily have to match between Editor and SyntaxHighlighter
const fontSize = '12px'
// Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
const fontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles()(theme => ({
  error: {
    color: 'red',
    fontSize: '0.8em',
  },
  callbackEditor: {
    fontFamily,
    fontSize,
    background: theme.palette.background.default,
    width: 800,
    marginTop: '16px',
    border: '1px solid rgba(0,0,0,0.42)',
  },
  callbackContainer: {
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
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    try {
      setError(undefined)
      slot.set(JSON.parse(contents))
    } catch (e) {
      console.error({ e })
      setError(e)
    }
  }, [contents, slot])

  return (
    <>
      {error ? <p className={classes.error}>{`${error}`}</p> : null}
      <div className={classes.callbackContainer}>
        <InputLabel shrink htmlFor="json-editor">
          {slot.name}
        </InputLabel>
        <TextField
          id="json-editor"
          className={classes.callbackEditor}
          value={contents}
          helperText={slot.description}
          multiline
          onChange={event => {
            setContents(event.target.value)
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
