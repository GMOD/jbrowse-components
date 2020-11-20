/* eslint-disable no-bitwise */
import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
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

const flagNames = [
  'read paired',
  'read mapped in proper pair',
  'read unmapped',
  'mate unmapped',
  'read reverse strand',
  'mate reverse strand',
  'first in pair',
  'second in pair',
  'not primary alignment',
  'read fails platform/vendor quality checks',
  'read is PCR or optical duplicate',
  'supplementary alignment',
]

function Bitmask(props: { flag: number; setFlag: Function }) {
  const { flag, setFlag } = props
  return (
    <>
      <TextField
        type="number"
        value={flag}
        onChange={event => setFlag(+event.target.value)}
      />
      {flagNames.map((name, index) => {
        const val = flag & (1 << index)
        const key = `${name}_${val}`
        return (
          <div key={key}>
            <input
              type="checkbox"
              checked={Boolean(val)}
              id={key}
              onChange={event => {
                if (event.target.checked) {
                  setFlag(flag | (1 << index))
                } else {
                  setFlag(flag & ~(1 << index))
                }
              }}
            />
            <label htmlFor={key}>{name}</label>
          </div>
        )
      })}
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default observer((props: { model: any; handleClose: () => void }) => {
  const { model, handleClose } = props
  const classes = useStyles()
  const display = model.displays[0]
  const effectiveDisplay = display.PileupDisplay || display
  const filter = effectiveDisplay.filterBy
  const [flagInclude, setFlagInclude] = useState(filter?.flagInclude)
  const [flagExclude, setFlagExclude] = useState(filter?.flagExclude)

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
            <div style={{ display: 'flex' }}>
              <div>
                <Typography>Read must have ALL these flags</Typography>
                <Bitmask flag={flagInclude} setFlag={setFlagInclude} />
              </div>
              <div>
                <Typography>Read must have NONE of these flags</Typography>
                <Bitmask flag={flagExclude} setFlag={setFlagExclude} />
              </div>
            </div>
            <Button
              variant="contained"
              onClick={() => {
                effectiveDisplay.setFilterBy({
                  flagInclude,
                  flagExclude,
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
