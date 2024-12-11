import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { Button, TextField, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { type Source } from '../util'

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

export default function BulkEditPanel({
  setCurrLayout,
  currLayout,
}: {
  currLayout: Source[]
  setCurrLayout: (arg: Source[]) => void
}) {
  const { classes } = useStyles()
  const [val, setVal] = useState('')
  const [error, setError] = useState<unknown>()
  return (
    <div>
      <Typography>
        Paste CSV or TSV. If a header column is present. First line is a header.
        If a column called "name" is present, it uses that to connect to IDs in
        the table, otherwise it uses the first column no.
      </Typography>
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
      <Button
        variant="contained"
        onClick={() => {
          const lines = val
            .split('\n')
            .map(f => f.trim())
            .filter(f => !!f)
          const fields = lines[0]!.split(/[,\t]/gm)
          if (fields.includes('name')) {
            setError('')
            const oldLayout = currLayout.map(record => [record.name, record])
            const newData = Object.fromEntries(
              lines.slice(1).map(line => {
                const cols = line.split(/[,\t]/gm)
                const newRecord = Object.fromEntries(
                  cols.map((col, idx) => [fields[idx], col]),
                )
                return [
                  newRecord.name,
                  { ...newRecord, ...oldLayout[newRecord.name] },
                ]
              }),
            )

            setCurrLayout(
              currLayout.map(record => ({
                ...record,
                ...newData[record.name],
              })),
            )
          } else {
            setError(new Error('No "name" column found on line 1'))
          }
        }}
      >
        Update rows
      </Button>
      <Button
        variant="contained"
        onClick={() => {
          const lines = val
            .split('\n')
            .map(f => f.trim())
            .filter(f => !!f)
          const fields = lines[0]!.split(/[,\t]/gm)
          if (fields.includes('name')) {
            setError('')
            const oldLayout = currLayout.map(record => [record.name, record])
            const newData = Object.fromEntries(
              lines.slice(1).map(line => {
                const cols = line.split(/[,\t]/gm)
                const newRecord = Object.fromEntries(
                  cols.map((col, idx) => [fields[idx], col]),
                )
                return [
                  newRecord.name,
                  { ...newRecord, ...oldLayout[newRecord.name] },
                ]
              }),
            )

            setCurrLayout(
              currLayout.map(record => ({
                ...newData[record.name],
              })),
            )
          } else {
            setError(new Error('No "name" column found on line 1'))
          }
        }}
      >
        Replace rows
      </Button>
      {error ? <ErrorMessage error={error} /> : null}
    </div>
  )
}
