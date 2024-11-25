import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'

export default function SetMinMaxDialog(props: {
  model: {
    minScore: number
    maxScore: number
    scaleType: string
    setMinScore: (arg?: number) => void
    setMaxScore: (arg?: number) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { minScore, maxScore, scaleType } = model

  const [min, setMin] = useState(
    `${minScore !== Number.MIN_VALUE ? minScore : ''}`,
  )
  const [max, setMax] = useState(
    `${maxScore !== Number.MAX_VALUE ? maxScore : ''}`,
  )

  const ok =
    min !== '' && max !== '' && !Number.isNaN(+min) && !Number.isNaN(+max)
      ? +max > +min
      : true

  const logOk =
    scaleType === 'log' && min !== '' && !Number.isNaN(+min) ? +min > 0 : true

  return (
    <Dialog open onClose={handleClose} title="Set min/max score for track">
      <DialogContent>
        <Typography>Enter min/max score: </Typography>
        {!ok ? (
          <Typography color="error">
            Max is greater than or equal to min
          </Typography>
        ) : null}

        {!logOk ? (
          <Typography color="error">
            Min score should be greater than 0 for log scale
          </Typography>
        ) : null}

        <TextField
          value={min}
          onChange={event => {
            setMin(event.target.value)
          }}
          placeholder="Enter min score"
        />
        <TextField
          value={max}
          onChange={event => {
            setMax(event.target.value)
          }}
          placeholder="Enter max score"
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          style={{ marginLeft: 20 }}
          disabled={!ok}
          onClick={() => {
            model.setMinScore(
              min !== '' && !Number.isNaN(+min) ? +min : undefined,
            )
            model.setMaxScore(
              max !== '' && !Number.isNaN(+max) ? +max : undefined,
            )
            handleClose()
          }}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}
