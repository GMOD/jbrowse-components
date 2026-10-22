import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { workflowForm } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { PASTE_JSON_WORKFLOW } from '../workflowNames.ts'
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
    const { form, update } = workflowForm(model, PASTE_JSON_WORKFLOW, {
      jsonText: '',
    })
    const [error, setError] = useState<unknown>()

    return (
      <div>
        {error ? <ErrorBanner error={error} /> : null}
        <TextField
          multiline
          rows={10}
          value={form.jsonText}
          placeholder="Paste track config or array of track configs in JSON format"
          variant="outlined"
          className={classes.textbox}
          onChange={event => {
            update({ jsonText: event.target.value })
          }}
        />
        <Button
          variant="contained"
          className={classes.submit}
          onClick={() => {
            void (async () => {
              try {
                setError(undefined)
                await doPasteConfigSubmit({ model, jsonText: form.jsonText })
              } catch (e) {
                console.error(e)
                setError(e)
              }
            })()
          }}
        >
          Submit
        </Button>
      </div>
    )
  },
)
export default PasteConfigAddTrackWorkflow
