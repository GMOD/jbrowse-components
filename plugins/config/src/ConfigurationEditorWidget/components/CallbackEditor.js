import { useDebounce } from '@jbrowse/core/util'
import { stringToFunction } from '@jbrowse/core/util/functionStrings'
import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import InputLabel from '@material-ui/core/InputLabel'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import Editor from 'react-simple-code-editor'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import javascript from 'react-syntax-highlighter/dist/cjs/languages/hljs/javascript'
import a11yDark from 'react-syntax-highlighter/dist/cjs/styles/hljs/a11y-dark'
import a11yLight from 'react-syntax-highlighter/dist/cjs/styles/hljs/a11y-light'

SyntaxHighlighter.registerLanguage('javascript', javascript)

// fontSize and fontFamily have to match between Editor and SyntaxHighlighter
const fontSize = '12px'
// Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
const fontFamily =
  'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace'

const useStyles = makeStyles(theme => ({
  callbackEditor: {
    marginTop: '16px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontFamily,
    fontSize,
  },
  syntaxHighlighter: {
    margin: 0,
    fontFamily,
    fontSize,
  },
}))

function CallbackEditor({ slot }) {
  const classes = useStyles()
  const theme = useTheme()

  const [code, setCode] = useState(slot.value)
  const [error, setCodeError] = useState()
  const debouncedCode = useDebounce(code, 400)

  useEffect(() => {
    try {
      stringToFunction(debouncedCode)
      slot.set(debouncedCode) // slot.set `jexl:${debouncedCode}`
      setCodeError(null)
    } catch (e) {
      setCodeError(e)
    }
  }, [debouncedCode, slot])

  // if default value is a callback, will have to remove jexl:
  // do this last
  return (
    <FormControl>
      <InputLabel shrink htmlFor="callback-editor">
        {slot.name}
      </InputLabel>
      <Editor
        className={classes.callbackEditor}
        value={code}
        onValueChange={newCode => {
          setCode(newCode)
        }}
        highlight={newCode => (
          <SyntaxHighlighter
            language="javascript" // maybe get rid of this
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
        style={{ background: error ? '#fdd' : undefined }}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </FormControl>
  )
}
CallbackEditor.propTypes = {
  slot: PropTypes.objectOrObservableObject.isRequired,
}
export default observer(CallbackEditor)
