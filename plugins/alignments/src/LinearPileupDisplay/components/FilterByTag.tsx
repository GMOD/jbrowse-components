/* eslint-disable no-bitwise */
import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import FormControl from '@material-ui/core/FormControl'
import FormLabel from '@material-ui/core/FormLabel'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import Link from '@material-ui/core/Link'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import IconButton from '@material-ui/core/IconButton'
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  root: {
    width: 600,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default observer((props: { model: any; handleClose: () => void }) => {
  const { model, handleClose } = props
  const classes = useStyles()
  const display = model.displays[0]
  const effectiveDisplay = display.PileupDisplay || display
  const filter = effectiveDisplay.filterBy
  const [flag, setFlag] = useState<number>(filter?.flag || 1536)
  const [mode, setMode] = useState('all')

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMode((event.target as HTMLInputElement).value)
  }

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
        <Typography>
          Set filter bitmask options. Refer to{' '}
          <Link href="https://broadinstitute.github.io/picard/explain-flags.html">
            https://broadinstitute.github.io/picard/explain-flags.html
          </Link>{' '}
          for details
        </Typography>
        <div className={classes.root}>
          <form>
            <div>
              <TextField
                label="Flag bitmask"
                type="number"
                value={flag}
                onChange={event => setFlag(+event.target.value)}
              />
            </div>

            <FormControl component="fieldset">
              <FormLabel component="legend">Filter mode</FormLabel>
              <RadioGroup name="mode" value={mode} onChange={handleChange}>
                <FormControlLabel
                  value="all"
                  control={<Radio />}
                  label="only include reads that have ALL of the flag bits set"
                />
                <FormControlLabel
                  value="none"
                  control={<Radio />}
                  label="only include reads that have NONE of the flag bits set"
                />
              </RadioGroup>
            </FormControl>
            <Button
              variant="contained"
              onClick={() => {
                effectiveDisplay.setFilterBy({
                  mode,
                  flag,
                })
                handleClose()
              }}
            >
              Submit
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
})
