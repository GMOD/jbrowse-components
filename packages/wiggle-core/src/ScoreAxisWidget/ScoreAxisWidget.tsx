import { useState } from 'react'

import { LabeledCheckbox } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { VALUE_SCALE_TYPES } from '../valueScaleConfigSchema.ts'
import RangeFields from './RangeFields.tsx'
import ReferenceLines from './ReferenceLines.tsx'
import ResetAxisButton from './ResetAxisButton.tsx'
import Section from './Section.tsx'
import ShareAxisWith from './ShareAxisWith.tsx'
import { writeThrough } from './writeThrough.ts'

import type { ScoreAxisWidgetModel } from './stateModel.ts'
import type { ScoreAxisDisplay } from './types.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    padding: theme.spacing(2),
    display: 'grid',
    gap: theme.spacing(2.5),
  },
}))

const SCALE_TYPE_LABELS: Record<(typeof VALUE_SCALE_TYPES)[number], string> = {
  linear: 'Linear',
  log: 'Log',
  symlog: 'Symlog',
}

// A density plot maps score to colour and rules no band, so it has no 0 to
// include and no lines to draw across it.
function rulesABand(display: ScoreAxisDisplay) {
  return display.scoreRulesDrawn === true
}

const AxisEditor = observer(function AxisEditor({
  display,
  onReset,
}: {
  display: ScoreAxisDisplay
  onReset: () => void
}) {
  const { classes } = useStyles()
  const { scaleType, manualMinScore, manualMaxScore, domainQuantile } = display
  const bothPinned =
    manualMinScore !== undefined && manualMaxScore !== undefined
  const zeroBlocker =
    scaleType === 'log'
      ? 'A log axis has no 0'
      : bothPinned
        ? 'Both ends are set'
        : undefined
  return (
    <div className={classes.root}>
      <Section title="Scale">
        <RadioGroup
          row
          value={scaleType}
          onChange={event => {
            writeThrough(display, () => {
              display.setScaleType(event.target.value)
            })
          }}
        >
          {VALUE_SCALE_TYPES.map(type => (
            <FormControlLabel
              key={type}
              value={type}
              control={<Radio size="small" />}
              label={SCALE_TYPE_LABELS[type]}
            />
          ))}
        </RadioGroup>
      </Section>
      <Section title="Range">
        <RangeFields display={display} />
        {rulesABand(display) ? (
          <LabeledCheckbox
            label="Include 0"
            checked={display.scaleZero}
            disabled={zeroBlocker !== undefined}
            onChange={zero => {
              writeThrough(display, () => {
                display.setScaleZero(zero)
              })
            }}
          />
        ) : null}
        <LabeledCheckbox
          label="Clip extreme outliers"
          checked={domainQuantile < 1}
          disabled={bothPinned}
          onChange={on => {
            writeThrough(display, () => {
              display.setDomainQuantile(on ? display.clipQuantile : 1)
            })
          }}
        />
        <FormHelperText>
          {bothPinned
            ? 'Both ends are set, so nothing here moves the axis'
            : (zeroBlocker ??
              `Clipping cuts a value that would leave the others under half the axis, and marks it in red`)}
        </FormHelperText>
      </Section>
      <ShareAxisWith display={display} />
      <Section title="Guides">
        <LabeledCheckbox
          label="Grid lines"
          checked={display.grid}
          onChange={grid => {
            writeThrough(display, () => {
              display.setGrid(grid)
            })
          }}
        />
        {rulesABand(display) ? <ReferenceLines display={display} /> : null}
      </Section>
      <ResetAxisButton display={display} onReset={onReset} />
    </div>
  )
})

// A reset rewrites what the text fields and reference-line rows hold as their
// own draft, so it remounts them.
export default observer(function ScoreAxisWidget({
  model,
}: {
  model: ScoreAxisWidgetModel
}) {
  const [generation, setGeneration] = useState(0)
  const display = model.display as ScoreAxisDisplay | undefined
  return display ? (
    <AxisEditor
      key={`${display.id}-${generation}`}
      display={display}
      onReset={() => {
        setGeneration(n => n + 1)
      }}
    />
  ) : (
    <Typography color="text.secondary" style={{ padding: 16 }}>
      The track this edited is no longer shown.
    </Typography>
  )
})
