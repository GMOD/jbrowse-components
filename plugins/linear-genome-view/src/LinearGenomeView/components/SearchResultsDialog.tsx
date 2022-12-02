import React from 'react'
import { resolveIdentifier, getRoot } from 'mobx-state-tree'
import { getSession, getEnv } from '@jbrowse/core/util'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { LinearGenomeViewModel } from '../..'

export default function SearchResultsDialog({
  model,
  optAssemblyName,
  handleClose,
}: {
  model: LinearGenomeViewModel
  optAssemblyName?: string
  handleClose: () => void
}) {
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  const { assemblyManager } = session
  let assemblyName = optAssemblyName
  if (model.displayedRegions.length > 0) {
    assemblyName = model.displayedRegions[0]?.assemblyName
  }
  if (!assemblyName) {
    throw new Error(`Assembly name not found`)
  }
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  if (!assembly.regions) {
    throw new Error(`assembly ${assemblyName} regions not loaded`)
  }
  const assemblyRegions = assembly.regions

  async function handleClick(location: string) {
    try {
      const newRegion = assemblyRegions.find(
        region => location === region.refName,
      )
      if (newRegion) {
        model.setDisplayedRegions([newRegion])
        // we use showAllRegions after setDisplayedRegions to make the entire
        // region visible, xref #1703
        model.showAllRegions()
      } else {
        await model.navToLocString(location, assemblyName)
      }
    } catch (e) {
      console.warn(e)
      session.notify(`${e}`, 'warning')
    }
  }

  function getTrackName(trackId: string | undefined) {
    if (trackId) {
      const schema = pluginManager.pluggableConfigSchemaType('track')
      const configuration = resolveIdentifier(schema, getRoot(model), trackId)
      return configuration?.name?.value || ''
    }
    return ''
  }

  return (
    <Dialog open maxWidth="xl" onClose={handleClose} title="Search results">
      <DialogContent>
        {!model.searchResults?.length ? (
          <Typography>
            No results found for <b>{model.searchQuery}</b>
          </Typography>
        ) : (
          <>
            <Typography>
              Showing results for <b>{model.searchQuery}</b>
            </Typography>
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
                  {model.searchResults.map(result => (
                    <TableRow key={`${result.getId()}`}>
                      <TableCell component="th" scope="row">
                        {result.getLabel()}
                      </TableCell>
                      <TableCell align="right">
                        {result.getLocation()}
                      </TableCell>
                      <TableCell align="right">
                        {getTrackName(result.getTrackId()) || 'N/A'}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          onClick={async () => {
                            try {
                              const location = result.getLocation()
                              if (location) {
                                await handleClick(location)
                                const resultTrackId = result.getTrackId()
                                if (resultTrackId) {
                                  model.showTrack(resultTrackId)
                                }
                              }
                            } catch (e) {
                              console.error(e)
                              session.notify(`${e}`, 'error')
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
          </>
        )}
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={() => handleClose()} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
