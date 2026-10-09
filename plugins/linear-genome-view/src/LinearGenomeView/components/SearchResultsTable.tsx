import { canonicalLocString } from '@jbrowse/core/TextSearch/places'
import { SanitizedHTML } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
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

import type { LinearGenomeViewModel } from '../../index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

const SearchResultsTable = observer(function SearchResultsTable({
  searchResults,
  assemblyName,
  model,
  onPick,
}: {
  searchResults: BaseResult[]
  assemblyName: string
  model: LinearGenomeViewModel
  onPick: (result: BaseResult) => Promise<unknown>
}) {
  const session = getSession(model)
  const { assemblyManager } = session
  const assembly = assemblyManager.get(assemblyName)

  function getTrackName(trackId: string | undefined) {
    const conf =
      trackId !== undefined ? session.getTrackById(trackId) : undefined
    return (conf?.name as string | undefined) ?? ''
  }

  // A location the assembly can't resolve is listed as-is: Go navigates
  // through navToOption, which reports its own failure
  function formatLocation(locString: string | undefined) {
    return assembly && locString
      ? canonicalLocString(locString, assembly)
      : locString
  }

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
          {searchResults.map(result => (
            <TableRow key={result.getId()}>
              <TableCell component="th" scope="row">
                {result.getLabel()}
              </TableCell>
              <TableCell align="right">
                {formatLocation(result.getLocation())}
              </TableCell>
              <TableCell align="right">
                <SanitizedHTML
                  html={getTrackName(result.getTrackId()) || 'N/A'}
                />
              </TableCell>
              <TableCell align="right">
                <Button
                  onClick={() => {
                    void onPick(result)
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
