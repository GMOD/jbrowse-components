import { useDebounce } from '@gmod/jbrowse-core/util'
import { stringToFunction } from '@gmod/jbrowse-core/util/functionStrings'
import FormControl from '@material-ui/core/FormControl'
import FormHelperText from '@material-ui/core/FormHelperText'
import InputLabel from '@material-ui/core/InputLabel'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism.css'
import React, { useEffect, useState } from 'react'
import Editor from 'react-simple-code-editor'

const useStyles = makeStyles(theme => ({
  callbackEditor: {
    marginTop: '16px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    // Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
    fontFamily:
      'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace',
    fontSize: '90%',
  },
}))

function CallbackEditor({ slot }) {
  const classes = useStyles()

  const [code, setCode] = useState(slot.value)
  const [error, setCodeError] = useState()
  const debouncedCode = useDebounce(code, 400)

  useEffect(() => {
    try {
      stringToFunction(debouncedCode)
      slot.set(debouncedCode)
      setCodeError(null)
    } catch (e) {
      setCodeError(e)
    }
  }, [debouncedCode, slot])

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
        highlight={newCode =>
          highlight(newCode, languages.javascript, 'javascript')
        }
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
