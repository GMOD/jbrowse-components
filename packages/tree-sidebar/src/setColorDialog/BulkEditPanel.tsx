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

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

// Parse CSV/TSV with a header row that includes a `name` column for join.
function parseRowsByName(val: string) {
  const lines = val
    .split('\n')
    .map(f => f.trim())
    .filter(f => !!f)
  const fields = lines[0]!.split(/[,\t]/)
  if (!fields.includes('name')) {
    throw new Error('No "name" column found on line 1')
  }
  const nameIdx = fields.indexOf('name')
  return Object.fromEntries(
    lines.slice(1).flatMap(line => {
      const cols = line.split(/[,\t]/)
      const name = cols[nameIdx]
      return name
        ? [[name, Object.fromEntries(fields.map((f, i) => [f, cols[i] ?? '']))]]
        : []
    }),
  )
}

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
      const newByName = parseRowsByName(val)
      onClose(
        currLayout.map(record => ({
          ...(replace ? {} : record),
          ...newByName[record.name],
          name: record.name,
        })) as S[],
      )
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
