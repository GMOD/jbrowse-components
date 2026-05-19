import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  root: {
    width: 500,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
})

interface CoverageRangeModel {
  coverageMinScore?: number
  coverageMaxScore?: number
  setCoverageMinScore: (v?: number) => void
  setCoverageMaxScore: (v?: number) => void
}

function parseNum(s: string) {
  return s !== '' && !Number.isNaN(+s) ? +s : undefined
}

const CoverageRangeDialog = observer(function CoverageRangeDialog(props: {
  model: CoverageRangeModel
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { classes } = useStyles()
  const [min, setMin] = useState(`${model.coverageMinScore ?? ''}`)
  const [max, setMax] = useState(`${model.coverageMaxScore ?? ''}`)

  return (
    <SubmitDialog
      open
      title="Set coverage range"
      onCancel={handleClose}
      onSubmit={() => {
        model.setCoverageMinScore(parseNum(min))
        model.setCoverageMaxScore(parseNum(max))
        handleClose()
      }}
    >
      <div className={classes.root}>
        <Typography>
          Pin the coverage scale to a fixed depth range. Leave blank to let
          autoscale pick the bounds.
        </Typography>
        <TextField
          value={min}
          autoFocus
          label="Min depth"
          onChange={event => {
            setMin(event.target.value)
          }}
        />
        <TextField
          value={max}
          label="Max depth"
          onChange={event => {
            setMax(event.target.value)
          }}
        />
      </div>
    </SubmitDialog>
  )
})

export default CoverageRangeDialog
