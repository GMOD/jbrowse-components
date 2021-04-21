import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'

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

function SortByTagDlg(props: {
  model: { setSortedBy: Function }
  handleClose: () => void
}) {
  const classes = useStyles()
  const { model, handleClose } = props
  const [tag, setTag] = useState('')
  const validTag = tag.match(/^[A-Za-z][A-Za-z0-9]$/)
  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
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
              model.setSortedBy('tag', tag)
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
export default observer(SortByTagDlg)
