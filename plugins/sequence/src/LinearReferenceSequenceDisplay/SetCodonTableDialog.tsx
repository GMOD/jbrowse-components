import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  IconButton,
  Link,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'

// icons
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  dialogContent: {
    width: '80em',
  },
  selectBox: {
    margin: theme.spacing(4),
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
}))

export default function SetCodonTableDialog({
  codonTable: codonTablePre,
  handleClose,
}: {
  codonTable: string
  handleClose: ({ codonTable }?: { codonTable: string }) => void
}) {
  const classes = useStyles()
  const [codonTable, setCodonTable] = useState(codonTablePre)
  return (
    <Dialog open maxWidth="xl" onClose={() => handleClose()}>
      <DialogTitle>
        Set codon table
        {handleClose ? (
          <IconButton
            className={classes.closeButton}
            onClick={() => {
              handleClose()
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <Typography>
          Settings for displaying the translation on the sequence track e.g.
          protein translations. See{' '}
          <Link href="https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi">
            table of genetic codes{' '}
          </Link>{' '}
          for more information on translation tables. You can replace the table
          below with one of choice from a different translation table.
        </Typography>
        <TextField
          variant="outlined"
          helperText="codon table"
          multiline
          minRows={5}
          fullWidth
          onChange={event => setCodonTable(event.target.value)}
          value={codonTable}
          InputProps={{
            classes: {
              input: classes.textAreaFont,
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleClose({ codonTable })}
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
