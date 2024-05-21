import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },

  error: {
    color: 'red',
    fontSize: '0.8em',
  },
})

function checkJexl(code: string) {
  stringToJexlExpression(code)
}

const AddFiltersDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    jexlFilters?: string[]
    activeFilters: string[]
    setJexlFilters: (arg?: string[]) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { activeFilters } = model
  const [data, setData] = useState(activeFilters.join('\n'))
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    try {
      data
        .split('\n')
        .map(line => line.trim())
        .filter(line => !!line)
        .map(line => checkJexl(line.trim()))
      setError(undefined)
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }, [data])

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Add track filters">
      <DialogContent>
        <div>
          Add filters, in jexl format, one per line, starting with the string
          jexl:. Example: <pre>jexl:get(feature,'name')=='BRCA1'</pre> to only
          show the feature where the name attrivute is "BRCA1" in view
        </div>

        {error ? <p className={classes.error}>{`${error}`}</p> : null}
        <TextField
          variant="outlined"
          multiline
          minRows={5}
          maxRows={10}
          className={classes.dialogContent}
          fullWidth
          value={data}
          onChange={event => setData(event.target.value)}
          InputProps={{
            classes: {
              input: classes.textAreaFont,
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          autoFocus
          disabled={!!error || !data.trim()}
          onClick={() => {
            model.setJexlFilters(data.split('\n'))
            handleClose()
          }}
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default AddFiltersDialog
