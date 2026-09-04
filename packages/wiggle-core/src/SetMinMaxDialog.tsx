import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

// The two fields open on what the config really pins, which is the mixin's
// `manual*` pair rather than the raw slots — the sentinel comparison is one
// answer per end and lives there. Submitting `undefined` writes the sentinel
// back, so an emptied field is how autoscale resumes.
export default observer(function SetMinMaxDialog(props: {
  model: {
    manualMinScore: number | undefined
    manualMaxScore: number | undefined
    scaleType: string
    setMinScore: (arg?: number) => void
    setMaxScore: (arg?: number) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { manualMinScore, manualMaxScore, scaleType } = model

  const [min, setMin] = useState(manualMinScore)
  const [max, setMax] = useState(manualMaxScore)

  const rangeOk = min === undefined || max === undefined || max > min
  const logOk = !(scaleType === 'log' && min !== undefined && min <= 0)

  return (
    <SubmitDialog
      open
      title="Set min/max score for track"
      submitDisabled={!rangeOk || !logOk}
      onCancel={handleClose}
      onSubmit={() => {
        model.setMinScore(min)
        model.setMaxScore(max)
        handleClose()
      }}
    >
      <Typography>Enter min/max score: </Typography>
      {!rangeOk ? (
        <Typography color="error">Max must be greater than min</Typography>
      ) : null}
      {!logOk ? (
        <Typography color="error">
          Min score should be greater than 0 for log scale
        </Typography>
      ) : null}
      <NumberTextField
        defaultValue={min}
        onValueChange={setMin}
        placeholder="Enter min score"
      />
      <NumberTextField
        defaultValue={max}
        onValueChange={setMax}
        placeholder="Enter max score"
      />
    </SubmitDialog>
  )
})
