/* eslint-disable no-bitwise */
import React, { useState } from 'react'
import { observer } from 'mobx-react'
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
  improperlyPaired: 'Properly paired',
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
  failedQc: 512,
} as { [key: string]: number }

function getFlag(state: Record<string, boolean>) {
  return Object.entries(state).reduce((accum, [key, val]) => {
    return val ? accum | flagMap[key] : accum
  }, 0)
}

function parseFlag(flag: number) {
  return Object.entries(flagMap).reduce((accum, [key, val]) => {
    if (flag & val) {
      accum[key] = true
    } else {
      accum[key] = false
    }
    return accum
  }, {} as { [key: string]: boolean })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default observer((props: { model: any; handleClose: () => void }) => {
  const { model, handleClose } = props
  const classes = useStyles()
  const display = model.displays[0]
  const filter = (display.PileupDisplay || display).filterBy

  const [state, setState] = useState(parseFlag(filter?.flag || 0))
  const [flag, setFlag] = useState<number>()

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
                    onChange={event => {
                      setState({
                        ...state,
                        [event.target.name]: event.target.checked,
                      })
                    }}
                    name={key}
                  />
                }
                label={mapping[key]}
              />
            </div>
          ))}

          <div>
            <TextField
              label="Enter flag value (reference https://broadinstitute.github.io/picard/explain-flags.html)"
              type="number"
              onChange={event => setFlag(+event.target.value)}
            />
          </div>
          <Button
            onClick={() => {
              const val = flag === undefined ? getFlag(state) : flag
              console.log({ val })
              ;(display.PileupDisplay || display).setFilterBy({
                inclusive: false,
                flag: val,
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
})
