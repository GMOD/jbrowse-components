import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'

import { mergeParsedRows, parseRowsByName } from './bulkEditParse.ts'

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

export default function BulkEditPanel<S extends { name: string }>({
  onClose,
  currLayout,
}: {
  currLayout: S[]
  onClose: (arg?: S[]) => void
}) {
  const { classes } = useStyles()
  const [val, setVal] = useState('')
  const [error, setError] = useState<unknown>()

  const apply = (replace: boolean) => {
    try {
      setError(undefined)
      onClose(mergeParsedRows(currLayout, parseRowsByName(val), replace))
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  return (
    <>
      <DialogContent>
        <Typography>
          Paste CSV or TSV. The first line is the header. A column called "name"
          is used to join to existing rows.
        </Typography>

        {error ? <ErrorBanner error={error} /> : null}
        <TextField
          variant="outlined"
          multiline
          minRows={5}
          placeholder={
            'name,population\nHG00098,GBR\nHG00101,GBR\nHG00459,CHS\n...'
          }
          maxRows={10}
          fullWidth
          value={val}
          onChange={event => {
            setVal(event.target.value)
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
          color="secondary"
          onClick={() => {
            apply(false)
          }}
        >
          Update rows
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            apply(true)
          }}
        >
          Replace rows
        </Button>
        <Button
          variant="contained"
          color="inherit"
          onClick={() => {
            onClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
}
