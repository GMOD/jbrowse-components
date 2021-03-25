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
    width: 300,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

export default function ColorByTagDlg(props: {
  display: { setColorScheme: Function }
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
        Color by tag
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent style={{ overflowX: 'hidden' }}>
        <div className={classes.root}>
          <Typography>Enter tag to color by: </Typography>
          <Typography color="textSecondary">
            Examples: XS or TS for RNA-seq inferred read strand, ts (lower-case)
            for minimap2 read strand, HP for haplotype, RG for read group, etc.
          </Typography>

          <TextField
            value={tag}
            onChange={event => {
              setTag(event.target.value)
            }}
            placeholder="Enter tag name"
            inputProps={{
              maxLength: 2,
              'data-testid': 'color-tag-name-input',
            }}
            error={tag.length === 2 && !validTag}
            helperText={tag.length === 2 && !validTag ? 'Not a valid tag' : ''}
            autoComplete="off"
            data-testid="color-tag-name"
          />
          <Button
            variant="contained"
            color="primary"
            style={{ marginLeft: 20 }}
            onClick={() => {
              display.setColorScheme({
                type: 'tag',
                tag,
              })
              handleClose()
            }}
            disabled={!validTag}
          >
            Submit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
