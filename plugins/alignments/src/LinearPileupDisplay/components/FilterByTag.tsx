/* eslint-disable no-bitwise */
import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Dialog from '@material-ui/core/Dialog'
import Checkbox from '@material-ui/core/Checkbox'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

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

const mapping = {
  missingMate: 'Missing mate',
  improperlyPaired: 'Improperly paired',
  secondary: 'Secondary alignments',
  supplementary: 'Supplementary (aka split or chimeric) alignments',
  pcrDup: 'PCR duplicate',
  failedQc: 'Failed vendor QC',
} as { [key: string]: string }

const flagMap = {
  missingMate: 8,
  improperlyPaired: 2,
  secondary: 256,
  supplementary: 2048,
  pcrDup: 1024,
  failQc: 512,
} as { [key: string]: number }

function getFlag(state: Record<string, boolean>) {
  return Object.entries(state).reduce((accum, [key, val]) => {
    return accum | (flagMap[key] & +val)
  }, 0)
}

export default function FilterByDlg(props: {
  model: AnyConfigurationModel
  handleClose: () => void
}) {
  const [state, setState] = useState({
    missingMate: true,
    improperlyPaired: true,
    secondary: true,
    supplementary: true,
    pcrDup: true,
    failedQc: true,
  })
  const [flag, setFlag] = useState<number>()

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, [event.target.name]: event.target.checked })
  }
  const classes = useStyles()
  const { model, handleClose } = props
  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        Filter options
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography>Filter options</Typography>
        <form>
          {Object.entries(state).map(([key, value]) => (
            <div key={key}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={value}
                    onChange={handleChange}
                    name={key}
                  />
                }
                label={mapping[key]}
              />
            </div>
          ))}

          <div>
            <TextField
              label="Custom flag input e.g. 255"
              type="number"
              onChange={event => setFlag(+event.target.value)}
            />
          </div>
          <Button
            onClick={() => {
              model.setFilterBy({
                type: 'tag',
                flag: flag === undefined ? getFlag(state) : flag,
              })
              handleClose()
            }}
          >
            Submit
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
