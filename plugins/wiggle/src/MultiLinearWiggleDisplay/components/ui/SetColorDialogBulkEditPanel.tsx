import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'

import type { Source } from '../../../util.ts'

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

function parseCsv(val: string, currLayout: Source[]) {
  const lines = val
    .split('\n')
    .map(f => f.trim())
    .filter(f => !!f)
  const fields = lines[0]!.split(/[,\t]/gm)
  if (!fields.includes('name')) {
    throw new Error('No "name" column found on line 1')
  }
  const oldLayout = Object.fromEntries(
    currLayout.map(record => [record.name, record]),
  )
  return {
    oldLayout,
    newData: Object.fromEntries(
      lines.slice(1).map(line => {
        const cols = line.split(/[,\t]/gm)
        const newRecord = Object.fromEntries(
          cols.map((col, idx) => [fields[idx], col]),
        )
        return [
          newRecord.name,
          {
            ...newRecord,
            ...oldLayout[newRecord.name],
          },
        ]
      }),
    ),
  }
}

export default function SetColorDialogBulkEditPanel({
  onClose,
  currLayout,
}: {
  currLayout: Source[]
  onClose: (arg?: Source[]) => void
}) {
  const { classes } = useStyles()
  const [val, setVal] = useState('')
  const [error, setError] = useState<unknown>()

  return (
    <>
      <DialogContent>
        <Typography>
          Paste CSV or TSV. If a header column is present. First line is a
          header. If a column called "name" is present, it uses that to connect
          to IDs in the table, otherwise it uses the first column no.
        </Typography>

        {error ? <ErrorMessage error={error} /> : null}
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
            try {
              setError('')
              const { newData } = parseCsv(val, currLayout)
              onClose(
                currLayout.map(record => ({
                  ...record,
                  ...newData[record.name],
                })),
              )
            } catch (e) {
              console.error(e)
              setError(e)
            }
          }}
        >
          Update rows
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            try {
              setError('')
              const { newData } = parseCsv(val, currLayout)
              onClose(
                currLayout.map(record => ({
                  ...newData[record.name],
                })) as Source[],
              )
            } catch (e) {
              setError(e)
            }
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
