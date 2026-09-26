import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Button, Typography } from '@mui/material'
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
  // The domain drawn right now, which the "Use current range" button copies
  // into the fields; undefined before it resolves, and the button waits.
  domain?: [number, number]
  handleClose: () => void
}) {
  const { model, domain, handleClose } = props
  const { manualMinScore, manualMaxScore, scaleType } = model

  const [min, setMin] = useState(manualMinScore)
  const [max, setMax] = useState(manualMaxScore)
  // The fields own their text, so filling them from the button remounts them.
  const [fill, setFill] = useState(0)

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
      <Typography>
        Enter min/max score, or leave a field empty to autoscale that end
      </Typography>
      {!rangeOk ? (
        <Typography color="error">Max must be greater than min</Typography>
      ) : null}
      {!logOk ? (
        <Typography color="error">
          Min score should be greater than 0 for log scale
        </Typography>
      ) : null}
      <NumberTextField
        key={`min-${fill}`}
        defaultValue={min}
        onValueChange={setMin}
        placeholder="Enter min score"
      />
      <NumberTextField
        key={`max-${fill}`}
        defaultValue={max}
        onValueChange={setMax}
        placeholder="Enter max score"
      />
      <div>
        {domain ? (
          <Button
            onClick={() => {
              setMin(domain[0])
              setMax(domain[1])
              setFill(n => n + 1)
            }}
          >
            Use current range
          </Button>
        ) : null}
        <Button
          disabled={min === undefined && max === undefined}
          onClick={() => {
            setMin(undefined)
            setMax(undefined)
            setFill(n => n + 1)
          }}
        >
          Clear
        </Button>
      </div>
    </SubmitDialog>
  )
})
