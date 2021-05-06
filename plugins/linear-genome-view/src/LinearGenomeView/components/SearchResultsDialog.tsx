import React from 'react'
import {
  getSnapshot,
  getEnv,
  resolveIdentifier,
  getRoot,
} from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { makeStyles } from '@material-ui/core/styles'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { LinearGenomeViewModel } from '../..'

export const useStyles = makeStyles(theme => ({
  dialogContent: {
    width: '80em',
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

export default function SearchResultsDialog({
  model,
  optAssemblyName,
  handleClose,
}: {
  model: LinearGenomeViewModel
  optAssemblyName?: string
  handleClose: () => void
}) {
  const classes = useStyles()
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

  function handleClick(location: string) {
    try {
      const newRegion = assemblyRegions.find(
        region => location === region.refName,
      )
      if (newRegion) {
        model.setDisplayedRegions([getSnapshot(newRegion)])
        // we use showAllRegions after setDisplayedRegions to make the entire
        // region visible, xref #1703
        model.showAllRegions()
      } else {
        model.navToLocString(location, assemblyName)
      }
    } catch (e) {
      console.warn(e)
      session.notify(`${e}`, 'warning')
    }
  }
  function handleShowTrack(trackId: string) {
    const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
    const configuration = resolveIdentifier(
      trackConfigSchema,
      getRoot(model),
      trackId,
    )
    // check if we have any tracks with that configuration
    const shownTracks = model.tracks.filter(
      t => t.configuration === configuration,
    )
    if (shownTracks.length === 0) {
      model.showTrack(trackId)
    }
  }

  function getTrackName(trackId: string | undefined) {
    if (trackId) {
      const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
      const configuration = resolveIdentifier(
        trackConfigSchema,
        getRoot(model),
        trackId,
      )
      if (configuration) {
        return configuration.name?.value
      }
    }
    return ''
  }

  return (
    <Dialog open onClose={handleClose} className={classes.dialogContent}>
      <DialogTitle id="search-results-dialog">
        Search Results
        {handleClose ? (
          <IconButton
            data-testid="close-resultsDialog"
            className={classes.closeButton}
            onClick={() => {
              handleClose()
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <Divider />
      <DialogContent>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Location</TableCell>
                <TableCell align="right">Track Id</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {model.searchResults.map((result: BaseResult, index) => (
                <TableRow key={`${result.getLabel()}-${index}`}>
                  <TableCell component="th" scope="row">
                    {result.getLabel()}
                  </TableCell>
                  <TableCell align="right">{result.getLocation()}</TableCell>
                  <TableCell align="right">
                    {getTrackName(result.getTrackId())}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      onClick={() => {
                        handleClick(result.getLocation())
                        handleClose()
                      }}
                      color="primary"
                      variant="contained"
                    >
                      Go
                    </Button>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      onClick={() => {
                        handleClick(result.getLocation())
                        const resultTrackId = result.getTrackId()
                        if (resultTrackId) {
                          handleShowTrack(resultTrackId)
                        }
                        handleClose()
                      }}
                      color="primary"
                      variant="contained"
                    >
                      Show
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="primary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
