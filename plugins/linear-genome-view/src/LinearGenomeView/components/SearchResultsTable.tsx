import { readConfObject } from '@jbrowse/core/configuration'
import {
  assembleLocString,
  getSession,
  parseLocString,
} from '@jbrowse/core/util'
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

import { isOpenInView, navToOption } from '../../searchUtils.ts'

import type { LinearGenomeViewModel } from '../../index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

const SearchResultsTable = observer(function SearchResultsTable({
  searchResults,
  assemblyName,
  model,
  handleClose,
}: {
  searchResults: BaseResult[]
  assemblyName: string
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const session = getSession(model)
  const { assemblyManager } = session
  const assembly = assemblyManager.get(assemblyName)

  function getTrackName(trackId: string | undefined) {
    const conf =
      trackId !== undefined ? session.getTrackById(trackId) : undefined
    return conf ? (readConfObject(conf, 'name') as string) : ''
  }

  // the raw locString, prettified to the assembly's canonical refName when the
  // assembly is loaded and the string parses. A result the assembly can't
  // resolve is still listed as-is rather than blowing up the dialog: the Go
  // button navigates through navToOption, which reports its own failure
  function formatLocation(locString: string | undefined) {
    if (assembly && locString) {
      try {
        const loc = parseLocString(locString, refName =>
          assembly.isValidRefName(refName),
        )
        return assembleLocString({
          ...loc,
          refName: assembly.getCanonicalRefName2(loc.refName),
        })
      } catch (e) {
        console.warn('failed to parse location string', locString, e)
        return locString
      }
    } else {
      return locString
    }
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
                {getTrackName(result.getTrackId()) || 'N/A'}
              </TableCell>
              <TableCell align="right">
                <Button
                  onClick={async () => {
                    try {
                      await navToOption({
                        option: result,
                        model,
                        assemblyName,
                      })
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
