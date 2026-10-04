import { useState } from 'react'

import { NumberTextField, SubmitDialog } from '@jbrowse/core/ui'
import {
  Button,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { toP } from './formatNumber.ts'

function formatRange(range: [number, number]) {
  return `${toP(range[0], 4)} – ${toP(range[1], 4)}`
}

// The two fields open on what the config really pins, which is the mixin's
// `manual*` pair rather than the raw slots. Submitting `undefined` writes the
// sentinel back, so an emptied field is how autoscale resumes. "Always include
// 0" sits beside them because it only moves an end left empty, and the two
// ranges above say whether it can move anything: values already reaching 0
// leave it nothing to do.
export default observer(function SetMinMaxDialog(props: {
  model: {
    manualMinScore: number | undefined
    manualMaxScore: number | undefined
    scaleType: string
    scaleZero: boolean
    // What the data in view spans before 0 and rounding, and the axis drawn
    // from it; undefined until they resolve, the alignments density tier's
    // features per bin standing in for depth among them.
    autoscaleRange: [number, number] | undefined
    autoscaledDomain: [number, number] | undefined
    setMinScore: (arg?: number) => void
    setMaxScore: (arg?: number) => void
    setScaleZero: (zero: boolean) => void
  }
  // Whether the scale rules a band for 0 to be the bottom of; a density plot
  // maps score to colour and spans its values whatever `zero` says.
  offerZero: boolean
  handleClose: () => void
}) {
  const { model, offerZero, handleClose } = props
  const {
    manualMinScore,
    manualMaxScore,
    scaleType,
    autoscaleRange,
    autoscaledDomain,
  } = model

  const [min, setMin] = useState(manualMinScore)
  const [max, setMax] = useState(manualMaxScore)
  const [zero, setZero] = useState(model.scaleZero)
  // The fields own their text, so filling them from the button remounts them.
  const [fill, setFill] = useState(0)

  const rangeOk = min === undefined || max === undefined || max > min
  const logOk = !(scaleType === 'log' && min !== undefined && min <= 0)
  const zeroBlocker =
    scaleType === 'log'
      ? 'A log axis has no 0'
      : min !== undefined && max !== undefined
        ? 'Both ends are set'
        : undefined

  return (
    <SubmitDialog
      open
      title="Set min/max score for track"
      submitDisabled={!rangeOk || !logOk}
      onCancel={handleClose}
      onSubmit={() => {
        model.setMinScore(min)
        model.setMaxScore(max)
        if (offerZero) {
          model.setScaleZero(zero)
        }
        handleClose()
      }}
    >
      <Typography>
        Enter min/max score, or leave a field empty to follow the data in view
      </Typography>
      {autoscaleRange ? (
        <Typography variant="body2" color="text.secondary">
          Values in view: {formatRange(autoscaleRange)}
        </Typography>
      ) : null}
      {autoscaledDomain ? (
        <Typography variant="body2" color="text.secondary">
          Axis drawn now: {formatRange(autoscaledDomain)}
        </Typography>
      ) : null}
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
        label="Min"
        defaultValue={min}
        onValueChange={setMin}
        placeholder="auto"
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <NumberTextField
        key={`max-${fill}`}
        label="Max"
        defaultValue={max}
        onValueChange={setMax}
        placeholder="auto"
        slotProps={{ inputLabel: { shrink: true } }}
      />
      {offerZero ? (
        <div>
          <FormControlLabel
            disabled={zeroBlocker !== undefined}
            control={
              <Checkbox
                checked={zero}
                onChange={event => {
                  setZero(event.target.checked)
                }}
              />
            }
            label="Always include 0"
          />
          {zeroBlocker ? <FormHelperText>{zeroBlocker}</FormHelperText> : null}
        </div>
      ) : null}
      <div>
        {autoscaledDomain ? (
          <Button
            onClick={() => {
              setMin(autoscaledDomain[0])
              setMax(autoscaledDomain[1])
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
