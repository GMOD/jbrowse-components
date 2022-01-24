import React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  makeStyles,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'

export const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

export default function HelpDialog({
  handleClose,
}: {
  handleClose: () => void
}) {
  const classes = useStyles()
  return (
    <Dialog open maxWidth="xl" onClose={handleClose}>
      <DialogTitle>
        Using the search box
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
        <h3>Searching</h3>
        <ul>
          <li>
            Jump to a feature or reference sequence by typing its name in the
            location box and pressing Enter.
          </li>
          <li>
            Jump to a specific region by typing the region into the location box
            as: <code>ref:start..end</code> or <code>ref:start-end</code>.
            Commas are allowed in the start and end coordinates.
          </li>
        </ul>
        <h3>Example Searches</h3>
        <ul>
          <li>
            <code>BRCA</code> - searches for the feature named BRCA
          </li>
          <li>
            <code>chr4</code> - jumps to chromosome 4
          </li>
          <li>
            <code>chr4:79,500,000..80,000,000</code> - jumps the region on
            chromosome 4 between 79.5Mb and 80Mb.
          </li>
        </ul>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button onClick={() => handleClose()} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
