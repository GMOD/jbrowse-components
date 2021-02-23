import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  root: {
    margin: 0,
    padding: theme.spacing(2),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

export default function SortByTagDlg(props: {
  display: { setSortedBy: Function }
  handleClose: () => void
}) {
  const classes = useStyles()
  const { display, handleClose } = props
  const [tag, setTag] = useState('')
  const validTag = tag.match(/^[A-Za-z][A-Za-z0-9]$/)
  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Sort by tag
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div>
          <Typography>Set the tag to sort by</Typography>
          <Typography color="textSecondary">
            Examples: HP for haplotype, RG for read group, etc.
          </Typography>
          <TextField
            value={tag}
            onChange={event => {
              setTag(event.target.value)
            }}
            placeholder="Enter tag name"
            inputProps={{
              maxLength: 2,
              'data-testid': 'sort-tag-name-input',
            }}
            error={tag.length === 2 && !validTag}
            helperText={tag.length === 2 && !validTag ? 'Not a valid tag' : ''}
            autoComplete="off"
            data-testid="sort-tag-name"
          />
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              display.setSortedBy('tag', tag)
              handleClose()
            }}
          >
            Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
