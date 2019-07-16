import {
  FormControl,
  FormHelperText,
  InputLabel,
  withStyles,
} from '@material-ui/core'
import { observer, PropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
import Editor from 'react-simple-code-editor'
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism.css'
import { stringToFunction } from '@gmod/jbrowse-core/util/functionStrings'

const styles = theme => ({
  callbackEditor: {
    marginTop: '16px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    // Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
    fontFamily:
      'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace',
    fontSize: '90%',
  },
})

function useDebounce(value, delay, slot) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay, slot])

  return debouncedValue
}

function CallbackEditor(props) {
  const { slot, classes } = props

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
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
}
export default withStyles(styles)(observer(CallbackEditor))
