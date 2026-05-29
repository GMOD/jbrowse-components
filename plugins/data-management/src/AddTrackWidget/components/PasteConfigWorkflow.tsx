import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { doPasteConfigSubmit } from './doPasteConfigSubmit.ts'

import type { AddTrackModel } from '../model.ts'

const useStyles = makeStyles()({
  textbox: {
    width: '100%',
  },
  submit: {
    marginTop: 25,
    marginBottom: 100,
    display: 'block',
  },
})

const PasteConfigAddTrackWorkflow = observer(
  function PasteConfigAddTrackWorkflow({ model }: { model: AddTrackModel }) {
    const { classes } = useStyles()
    const [val, setVal] = useState('')
    const [error, setError] = useState<unknown>()

    return (
      <div>
        {error ? <ErrorBanner error={error} /> : null}
        <TextField
          multiline
          rows={10}
          value={val}
          placeholder="Paste track config or array of track configs in JSON format"
          variant="outlined"
          className={classes.textbox}
          onChange={event => {
            setVal(event.target.value)
          }}
        />
        <Button
          variant="contained"
          className={classes.submit}
          onClick={() => {
            try {
              setError(undefined)
              doPasteConfigSubmit({ model, jsonText: val })
            } catch (e) {
              console.error(e)
              setError(e)
            }
          }}
        >
          Submit
        </Button>
      </div>
    )
  },
)
export default PasteConfigAddTrackWorkflow
