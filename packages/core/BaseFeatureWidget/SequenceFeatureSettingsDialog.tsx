import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  Link,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'

// icons
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  formElt: {
    margin: theme.spacing(3),
  },
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

export default function SequenceFeatureSettingsDialog({
  handleClose,
  codonTable: codonTableArg,
  intronBp: intronBpArg,
  upDownStreamBp: upDownStreamBpArg,
}: {
  handleClose: (arg?: {
    codonTable: string
    intronBp: number
    upDownStreamBp: number
  }) => void
  codonTable: string
  intronBp: number
  upDownStreamBp: number
}) {
  const classes = useStyles()
  const [codonTable, setCodonTable] = useState(`${codonTableArg}`)
  const [intronBp, setIntronBp] = useState(`${intronBpArg}`)
  const [upDownStreamBp, setUpDownStreamBp] = useState(`${upDownStreamBpArg}`)
  return (
    <Dialog maxWidth="xl" open onClose={() => handleClose()}>
      <DialogTitle>
        Feature sequence panel settings
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
      <Divider />

      <DialogContent className={classes.dialogContent}>
        <Typography>
          Settings for the calculating feature sequences e.g. protein
          translations. See{' '}
          <Link href="https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi">
            table of genetic codes
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

        <TextField
          helperText="#bp surrounding splice site in intron to display"
          className={classes.formElt}
          value={intronBp}
          onChange={event => setIntronBp(event.target.value)}
        />
        <TextField
          helperText="#bp up/down stream of the feature to display"
          className={classes.formElt}
          value={upDownStreamBp}
          onChange={event => setUpDownStreamBp(event.target.value)}
        />
      </DialogContent>

      <DialogActions>
        <Button
          onClick={() =>
            handleClose({
              codonTable,
              upDownStreamBp: +upDownStreamBp,
              intronBp: +intronBp,
            })
          }
          color="primary"
          variant="contained"
        >
          Submit
        </Button>
        <Button
          onClick={() => handleClose()}
          color="secondary"
          autoFocus
          variant="contained"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
