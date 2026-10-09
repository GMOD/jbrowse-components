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
} from '@mui/material'
import { observer } from 'mobx-react'

import type { SearchPickerState } from '../model.ts'

const SearchResultsTable = observer(function SearchResultsTable({
  picker,
}: {
  picker: SearchPickerState
}) {
  return (
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
          {picker.rows.map(row => (
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
  )
})

export default SearchResultsTable
