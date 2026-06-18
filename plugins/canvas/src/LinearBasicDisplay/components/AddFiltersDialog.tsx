import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'
import { observer } from 'mobx-react'

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

// Non-blank, trimmed lines — the filter list excludes blank lines a user leaves
// in the textarea, and the same set is what gets validated.
function filterLines(text: string) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line)
}

// jexl compile error for the current text, or undefined when every line parses.
// Derived during render (no effect needed) — compilation is cached per string.
function jexlError(text: string) {
  try {
    for (const line of filterLines(text)) {
      stringToJexlExpression(line)
    }
    return undefined
  } catch (e) {
    return e
  }
}

const AddFiltersDialog = observer(function AddFiltersDialog({
  model,
  handleClose,
}: {
  model: {
    activeFilters: () => string[]
    setJexlFilters: (arg?: string[]) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [data, setData] = useState(model.activeFilters().join('\n'))
  const error = jexlError(data)

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Add track filters">
      <DialogContent>
        <div>
          Add filters, in jexl format, one per line, starting with the string
          jexl:. Examples:{' '}
          <ul>
            <li>
              <code>jexl:get(feature,'name')=='BRCA1'</code> - show only
              features where the name attribute is BRCA1
            </li>
            <li>
              <code>jexl:get(feature,'type')=='gene'</code> - show only gene
              type features in a GFF that has many other feature types
            </li>
            <li>
              <code>jexl:get(feature,'score') &gt; 400</code> - show only
              features that have a score greater than 400
            </li>
            <li>
              <code>
                jexl:get(feature,'end') - get(feature,'start') &lt; 1000000
              </code>{' '}
              - show only features with length less than 1Mbp
            </li>
          </ul>
          <p>
            Please see the{' '}
            <a href="https://jbrowse.org/jb2/docs/config_guides/jexl/">Jexl</a>{' '}
            documentation for more information
          </p>
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
          onChange={event => {
            setData(event.target.value)
          }}
          slotProps={{
            input: {
              classes: {
                input: classes.textAreaFont,
              },
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
          disabled={!!error}
          onClick={() => {
            model.setJexlFilters(filterLines(data))
            handleClose()
          }}
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default AddFiltersDialog
