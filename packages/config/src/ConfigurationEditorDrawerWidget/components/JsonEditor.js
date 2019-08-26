import { useDebounce } from '@gmod/jbrowse-core/util'
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

const useStyles = makeStyles({
  callbackEditor: {
    // Optimize by using system default fonts: https://css-tricks.com/snippets/css/font-stacks/
    fontFamily:
      'Consolas, "Andale Mono WT", "Andale Mono", "Lucida Console", "Lucida Sans Typewriter", "DejaVu Sans Mono", "Bitstream Vera Sans Mono", "Liberation Mono", "Nimbus Mono L", Monaco, "Courier New", Courier, monospace',
    fontSize: '90%',
    overflowX: 'auto',
    marginTop: '16px',
    borderBottom: '1px solid rgba(0,0,0,0.42)',
  },
})

function JsonEditor({ slot }) {
  const classes = useStyles()
  const [json, setJson] = useState(JSON.stringify(slot.value, null, '  '))
  const [error, setError] = useState(false)
  const debouncedJson = useDebounce(json, 400)

  useEffect(() => {
    try {
      const parsed = JSON.parse(debouncedJson)
      slot.set(parsed)
      setError(false)
    } catch (e) {
      setError(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedJson])

  return (
    <FormControl error={error}>
      <InputLabel shrink htmlFor="callback-editor">
        {`${slot.name}${error ? ' (invalid JSON)' : ''}`}
      </InputLabel>
      <Editor
        className={classes.callbackEditor}
        value={json}
        onValueChange={setJson}
        highlight={newCode =>
          highlight(newCode, languages.javascript, 'javascript')
        }
        padding={10}
        style={{}}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </FormControl>
  )
}

JsonEditor.propTypes = {
  slot: PropTypes.objectOrObservableObject.isRequired,
}

export default observer(JsonEditor)
