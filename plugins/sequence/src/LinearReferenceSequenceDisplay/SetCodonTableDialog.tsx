import React, { useState } from 'react'
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  IconButton,
  Link,
  TextField,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { defaultCodonTable } from '@jbrowse/core/util'

// icons
import CloseIcon from '@mui/icons-material/Close'

const useStyles = makeStyles()(theme => ({
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
  const { classes } = useStyles()
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
          Settings for the calculating feature sequences e.g. protein
          translations. See{' '}
          <Link
            href="https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi"
            target="_blank"
          >
            table of genetic codes
          </Link>{' '}
          for more information on translation tables. You can replace the table
          below with one of choice from a different translation table. Note:
          this will set the codon table for the current session, so results will
          apply to other areas of the app
        </Typography>{' '}
        {codonTable !== defaultCodonTable ? (
          <Chip
            color="primary"
            label="Using alternative codon table"
            size="small"
          />
        ) : null}
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
        <Button
          variant="contained"
          onClick={() => setCodonTable(defaultCodonTable)}
        >
          Reset to standard table
        </Button>
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
