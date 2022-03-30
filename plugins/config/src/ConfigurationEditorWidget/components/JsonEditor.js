import React, { lazy, useEffect, useState } from 'react'
import { useDebounce } from '@jbrowse/core/util'
import {
  FormControl,
  FormHelperText,
  InputLabel,
  makeStyles,
} from '@material-ui/core'
import { observer, PropTypes } from 'mobx-react'
const useStyles = makeStyles({
  error: {
    color: 'red',
    fontSize: '0.8em',
  },
})

const CodeEditor = lazy(() => import('./CodeEditor'))

function JsonEditor({ slot }) {
  const classes = useStyles()
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
  }, [debouncedJson])

  return (
    <>
      {error ? <p className={classes.error}>{error}</p> : null}
      <FormControl error={error}>
        <InputLabel shrink htmlFor="callback-editor">
          {slot.name}
        </InputLabel>
        <React.Suspense fallback={<div />}>
          <CodeEditor contents={contents} setContents={setContents} />
        </React.Suspense>
        <FormHelperText>{slot.description}</FormHelperText>
      </FormControl>
    </>
  )
}

JsonEditor.propTypes = {
  slot: PropTypes.objectOrObservableObject.isRequired,
}

export default observer(JsonEditor)
