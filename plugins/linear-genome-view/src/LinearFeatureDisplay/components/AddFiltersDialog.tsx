import { useEffect, useState } from 'react'

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

function checkJexl(code: string) {
  stringToJexlExpression(code)
}

const AddFiltersDialog = observer(function AddFiltersDialog({
  model,
  handleClose,
}: {
  model: {
    jexlFilters?: string[]
    activeFilters: () => string[]
    setJexlFilters: (arg?: string[]) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { activeFilters } = model
  const [data, setData] = useState(activeFilters().join('\n'))
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    try {
      for (const line of data
        .split('\n')
        .map(line => line.trim())
        .filter(line => !!line)) {
        checkJexl(line)
      }
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
          jexl:. Examples:{' '}
          <ul>
            <li>
              <code>jexl:get(feature,'name')=='BRCA1'</code> - show only feature
              where the name attribute is BRCA1
            </li>
            <li>
              <code>jexl:startsWith(get(feature,'name'),'PREFIX')</code> - show
              only feature where the string 'PREFIX' is the prefix of feature
              name. endsWith also works
            </li>
            <li>
              <code>jexl:includes(get(feature,'name'),'PREFIX')</code> - show
              only feature where the string 'PREFIX' is the prefix of feature
              name
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
            Please see{' '}
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
            model.setJexlFilters(data.split('\n'))
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
