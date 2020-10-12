import { useDebounce } from '@jbrowse/core/util'
import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import InputLabel from '@material-ui/core/InputLabel'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import Editor from 'react-simple-code-editor'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/cjs/languages/hljs/json'
import a11yDark from 'react-syntax-highlighter/dist/cjs/styles/hljs/a11y-dark'
import a11yLight from 'react-syntax-highlighter/dist/cjs/styles/hljs/a11y-light'

SyntaxHighlighter.registerLanguage('json', json)

// fontSize and fontFamily have to match between Editor and SyntaxHighlighter
const fontSize = '12px'
// Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
const fontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles({
  callbackEditor: {
    fontFamily,
    fontSize,
    overflowX: 'auto',
    marginTop: '16px',
    borderBottom: '1px solid rgba(0,0,0,0.42)',
  },
  syntaxHighlighter: {
    margin: 0,
    fontFamily,
    fontSize,
  },
  error: {
    color: 'red',
    fontSize: '0.8em',
  },
})

function JsonEditor({ slot }) {
  const classes = useStyles()
  const theme = useTheme()
  const [contents, setContents] = useState(
    JSON.stringify(slot.value, null, '  '),
  )
  const [error, setError] = useState()
  const debouncedJson = useDebounce(contents, 400)

  useEffect(() => {
    try {
      slot.set(JSON.parse(debouncedJson))
      setError(undefined)
    } catch (e) {
      setError(e.message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedJson])

  return (
    <>
      {error ? <p className={classes.error}>{error}</p> : null}
      <FormControl error={error}>
        <InputLabel shrink htmlFor="callback-editor">
          {slot.name}
        </InputLabel>
        <Editor
          className={classes.callbackEditor}
          value={contents}
          onValueChange={setContents}
          highlight={newCode => (
            <SyntaxHighlighter
              language="json"
              style={theme.palette.type === 'dark' ? a11yDark : a11yLight}
              className={classes.syntaxHighlighter}
              // override some inline style stuff that's higher specificity
              // than className
              customStyle={{ background: 'none', padding: 0 }}
            >
              {newCode}
            </SyntaxHighlighter>
          )}
          padding={10}
          style={{}}
        />
        <FormHelperText>{slot.description}</FormHelperText>
      </FormControl>
    </>
  )
}

JsonEditor.propTypes = {
  slot: PropTypes.objectOrObservableObject.isRequired,
}

export default observer(JsonEditor)
