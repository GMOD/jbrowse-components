import React, { useEffect, useState } from 'react'
import { TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// fontSize and fontFamily have to match between Editor and SyntaxHighlighter
const fontSize = '12px'
// Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
const fontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles()(theme => ({
  callbackEditor: {
    fontFamily,
    fontSize,
    background: theme.palette.background.default,
    overflowX: 'auto',
    marginTop: '16px',
    border: '1px solid rgba(0,0,0,0.42)',
  },
  textAreaFont: {
    fontFamily,
  },
}))

export default function CodeEditor({
  contents,
  setContents,
}: {
  contents: string
  setContents: (arg: string) => void
}) {
  const { classes } = useStyles()
  const [error, setCodeError] = useState<unknown>()
  const [val, setVal] = useState(contents)
  useEffect(() => {
    try {
      JSON.parse(contents)
      setCodeError(undefined)
      setContents(val)
    } catch (e) {
      console.error({ e })
      setCodeError(e)
    }
  }, [val, contents])

  return (
    <TextField
      className={classes.callbackEditor}
      value={contents}
      onChange={event => setVal(event.target.value)}
      style={{ background: error ? '#fdd' : undefined }}
      InputProps={{
        classes: {
          input: classes.textAreaFont,
        },
      }}
    />
  )
}
