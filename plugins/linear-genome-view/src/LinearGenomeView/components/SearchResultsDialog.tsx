import React from 'react'
import { getSession } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
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
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const classes = useStyles()
  const session = getSession(model)
  // const { pluginManager } = getEnv(session)
  // TODO:  match the trackid of JB1 to JB2?
  function handleClick(location: string) {
    try {
      const newRegion: Region | undefined = model.displayedRegions.find(
        region => location === region.refName,
      )
      if (newRegion) {
        model.setDisplayedRegions([newRegion])
        // we use showAllRegions after setDisplayedRegions to make the entire
        // region visible, xref #1703
        model.showAllRegions()
      } else {
        model.navToLocString(location)
      }
    } catch (e) {
      console.warn(e)
      session.notify(`${e}`, 'warning')
    }
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
                <TableCell align="right">Track Name</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {model.searchResults.map((result: BaseResult, index) => (
                <TableRow key={`${result.getRendering()}-${index}`}>
                  <TableCell component="th" scope="row">
                    {result.getRendering()}
                  </TableCell>
                  <TableCell align="right">{result.getLocation()}</TableCell>
                  <TableCell align="right">{result.getTrackName()}</TableCell>
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
