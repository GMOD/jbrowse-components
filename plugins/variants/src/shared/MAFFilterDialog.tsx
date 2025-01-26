import { useState } from 'react'

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  root: {
    width: 500,
  },
})

const MAFFilterDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    minorAlleleFrequencyFilter?: number
    setMafFilter: (arg: number) => void
  }
  handleClose: () => void
}) {
  const { minorAlleleFrequencyFilter = '' } = model
  const { classes } = useStyles()
  const [maf, setMaf] = useState(`${minorAlleleFrequencyFilter}`)

  return (
    <Dialog open onClose={handleClose} title="Set minor allele frequency (MAF)">
      <DialogContent className={classes.root}>
        <Typography>
          Set minor allele frequency cutoff track. This will filter out rare
          variants that might not contribute to meaningful large scale patterns
        </Typography>
        <TextField
          value={maf}
          autoFocus
          placeholder="Enter MAF"
          onChange={event => {
            setMaf(event.target.value)
          }}
        />
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            autoFocus
            onClick={() => {
              if (!Number.isNaN(+maf)) {
                model.setMafFilter(+maf)
              }
              handleClose()
            }}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
})

export default MAFFilterDialog
