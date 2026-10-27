import { useState } from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { SearchPickerRow, SearchPickerState } from '../model.ts'

// past this many rows a list is easier to narrow than to read; gene names
// sort too irregularly (scn1ab, HOXA10-AS) for an order to stand in for it
const FILTER_AT = 8

export function filterRows(rows: SearchPickerRow[], text: string) {
  const needle = text.trim().toLowerCase()
  return needle
    ? rows.filter(row =>
        [row.label, row.location, row.trackName].some(field =>
          field.toLowerCase().includes(needle),
        ),
      )
    : rows
}

const SearchResultsTable = observer(function SearchResultsTable({
  picker,
}: {
  picker: SearchPickerState
}) {
  const [filter, setFilter] = useState('')
  const rows = filterRows(picker.rows, filter)
  return (
    <>
      {picker.rows.length > FILTER_AT ? (
        <TextField
          autoFocus
          fullWidth
          size="small"
          margin="dense"
          placeholder="Filter by name, location or track"
          value={filter}
          onChange={event => {
            setFilter(event.target.value)
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && rows.length === 1) {
              void picker.pick(rows[0]!.id)
            }
          }}
          helperText={
            filter ? `${rows.length} of ${picker.rows.length}` : undefined
          }
        />
      ) : null}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Location</TableCell>
              <TableCell align="right">Track</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.id}>
                <TableCell component="th" scope="row">
                  {row.label}
                </TableCell>
                <TableCell align="right">{row.location}</TableCell>
                <TableCell align="right">
                  <SanitizedHTML html={row.trackName || 'N/A'} />
                </TableCell>
                <TableCell align="right">
                  <Button
                    onClick={() => {
                      void picker.pick(row.id)
                    }}
                    color="primary"
                    variant="contained"
                  >
                    Go
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
})

export default SearchResultsTable
