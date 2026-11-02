import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  ignoredColumns,
  mergeParsedRows,
  parseRowsByName,
  toCSV,
  unmatchedNames,
} from './bulkEditParse.ts'

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

export default observer(function BulkEditPanel<S extends { name: string }>({
  onClose,
  currLayout,
}: {
  currLayout: S[]
  onClose: (arg?: S[]) => void
}) {
  const { classes } = useStyles()
  const [val, setVal] = useState('')

  // Parse live so warnings are visible before the user clicks Apply.
  const parsed = (() => {
    if (!val.trim()) {
      return undefined
    }
    try {
      return parseRowsByName(val)
    } catch (e) {
      return e instanceof Error ? e : new Error(String(e))
    }
  })()

  const parseError = parsed instanceof Error ? parsed : undefined
  const byName = parsed instanceof Error ? undefined : parsed
  const unmatched = byName ? unmatchedNames(currLayout, byName) : []
  const ignored = byName ? ignoredColumns(currLayout, byName) : []

  const apply = (replace: boolean) => {
    if (!byName) {
      return
    }
    onClose(mergeParsedRows(currLayout, byName, replace))
  }

  return (
    <>
      <DialogContent>
        <Typography>
          Paste CSV or TSV. The first line is the header. A{' '}
          <strong>name</strong> column joins rows to existing sources, and the{' '}
          <strong>label</strong> and <strong>rowColor</strong> columns set them.
          <br />
          <strong>Update rows</strong> sets only the pasted columns.{' '}
          <strong>Replace rows</strong> also clears a matched row&apos;s label
          or rowColor where the paste has no column for it.
        </Typography>

        {parseError ? <ErrorBanner error={parseError} /> : null}

        {ignored.length > 0 ? (
          <Alert severity="warning" style={{ marginTop: 8 }}>
            Only label and rowColor are set here, so changes to{' '}
            {ignored.join(', ')} will be ignored
          </Alert>
        ) : null}

        {unmatched.length > 0 ? (
          <Alert severity="warning" style={{ marginTop: 8 }}>
            {unmatched.length} name
            {unmatched.length === 1 ? '' : 's'} in the paste did not match any
            source and will be ignored: {unmatched.slice(0, 5).join(', ')}
            {unmatched.length > 5 ? ` … (${unmatched.length - 5} more)` : ''}
          </Alert>
        ) : null}

        <TextField
          variant="outlined"
          multiline
          minRows={5}
          placeholder={
            'name,label,rowColor\nHG00098,,#e41a1c\nHG00101,Mother,\n…'
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
          variant="outlined"
          onClick={() => {
            void navigator.clipboard.writeText(toCSV(currLayout))
          }}
        >
          Copy current as CSV
        </Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={!byName}
          onClick={() => {
            apply(false)
          }}
        >
          Update rows
        </Button>
        <Button
          variant="contained"
          color="primary"
          disabled={!byName}
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
})
