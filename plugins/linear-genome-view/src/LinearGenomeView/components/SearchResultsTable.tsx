import {
  assembleLocString,
  getEnv,
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
import { getRoot, resolveIdentifier } from 'mobx-state-tree'

import { navToOption } from '../../searchUtils'

import type { LinearGenomeViewModel } from '../..'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

export default function SearchResultsTable({
  searchResults,
  assemblyName: optAssemblyName,
  model,
  handleClose,
}: {
  searchResults: BaseResult[]
  assemblyName?: string
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  const { assemblyManager } = session
  const assemblyName =
    optAssemblyName || model.displayedRegions[0]!.assemblyName

  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  if (!assembly.regions) {
    throw new Error(`assembly ${assemblyName} regions not loaded`)
  }

  function getTrackName(trackId: string | undefined) {
    if (trackId) {
      const schema = pluginManager.pluggableConfigSchemaType('track')
      const configuration = resolveIdentifier(schema, getRoot(model), trackId)
      return configuration?.name?.value || ''
    }
    return ''
  }
  async function handleClick(result: BaseResult) {
    if (result.hasLocation()) {
      await navToOption({
        option: result,
        model,
        assemblyName,
      })
    } else {
      // label is used if it is a refName, it has no location
      const location = result.getLabel()
      const newRegion = assembly?.regions?.find(
        region => location === region.refName,
      )
      if (newRegion) {
        model.setDisplayedRegions([newRegion])
        // we use showAllRegions after setDisplayedRegions to make the entire
        // region visible, xref #1703
        model.showAllRegions()
      }
    }
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
          {searchResults.map(result => {
            const locString = result.getLocation()
            let loc
            try {
              loc = locString
                ? parseLocString(locString, refName =>
                    assembly.isValidRefName(refName),
                  )
                : undefined
            } catch (e) {}
            return (
              <TableRow key={result.getId()}>
                <TableCell component="th" scope="row">
                  {result.getLabel()}
                </TableCell>
                <TableCell align="right">
                  {loc
                    ? assembleLocString({
                        ...loc,
                        refName:
                          assembly.getCanonicalRefName(loc.refName) ||
                          loc.refName,
                      })
                    : locString}
                </TableCell>
                <TableCell align="right">
                  {getTrackName(result.getTrackId()) || 'N/A'}
                </TableCell>
                <TableCell align="right">
                  <Button
                    onClick={async () => {
                      try {
                        await handleClick(result)
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
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
