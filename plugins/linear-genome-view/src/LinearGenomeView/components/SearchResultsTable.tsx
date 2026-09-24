import { readConfObject } from '@jbrowse/core/configuration'
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

import { canonicalLocString, isOpenInView } from '../../searchUtils.ts'

import type { LinearGenomeViewModel } from '../../index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

const SearchResultsTable = observer(function SearchResultsTable({
  searchResults,
  assemblyName,
  model,
  handleClose,
  onPick,
}: {
  searchResults: BaseResult[]
  assemblyName: string
  model: LinearGenomeViewModel
  handleClose: () => void
  onPick: (result: BaseResult) => Promise<unknown>
}) {
  const session = getSession(model)
  const { assemblyManager } = session
  const assembly = assemblyManager.get(assemblyName)

  function getTrackName(trackId: string | undefined) {
    const conf =
      trackId !== undefined ? session.getTrackById(trackId) : undefined
    return conf ? (readConfObject(conf, 'name') as string) : ''
  }

  // A location the assembly can't resolve is listed as-is: Go navigates
  // through navToOption, which reports its own failure
  function formatLocation(locString: string | undefined) {
    return assembly && locString
      ? canonicalLocString(locString, assembly)
      : locString
  }

  // A hit in a track that is already on screen is usually the one meant, so it
  // is listed first rather than given a control that says so. sort is stable,
  // so everything else keeps the ranked order it arrived in.
  const ordered = [...searchResults].sort(
    (a, b) => Number(isOpenInView(b, model)) - Number(isOpenInView(a, model)),
  )

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
          {ordered.map(result => (
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
                  onClick={async () => {
                    try {
                      await onPick(result)
                    } catch (e) {
                      console.error(e)
                      session.notifyError(`${e}`, e)
                    }
                    handleClose()
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
