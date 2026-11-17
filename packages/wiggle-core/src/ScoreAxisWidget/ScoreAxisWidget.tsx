import { LabeledCheckbox } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  VALUE_SCALE_TYPES,
  isScaleType,
} from '@jbrowse/display-ui/yAxisConstants'
import { FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import RangeFields from './RangeFields.tsx'
import ReferenceLines from './ReferenceLines.tsx'
import ResetAxisButton from './ResetAxisButton.tsx'
import Section from './Section.tsx'
import ShareAxisWith from './ShareAxisWith.tsx'

import type { ScoreAxisWidgetModel } from './stateModel.ts'
import type { ScoreAxisDisplay } from './types.ts'
import type { ScaleType } from '@jbrowse/display-ui/yAxisConstants'

const useStyles = makeStyles()(theme => ({
  root: {
    padding: theme.spacing(3),
    display: 'grid',
    gap: theme.spacing(4),
  },
  checkboxes: {
    display: 'grid',
  },
}))

const SCALE_TYPE_LABELS: Record<ScaleType, string> = {
  linear: 'Linear',
  log: 'Log',
  symlog: 'Signed log',
}

// A density plot maps score to color and rules no band, so it has no 0 to
// include and no lines to draw across it.
function rulesABand(display: ScoreAxisDisplay) {
  return display.scoreRulesDrawn === true
}

const AxisEditor = observer(function AxisEditor({
  display,
}: {
  display: ScoreAxisDisplay
}) {
  const { classes } = useStyles()
  const { scaleType, domainMin, domainMax, fenceQuantile } = display
  const bothPinned = domainMin !== undefined && domainMax !== undefined
  return (
    <div className={classes.root}>
      <Section title="Scale">
        <RadioGroup
          row
          value={scaleType}
          onChange={event => {
            const { value } = event.target
            if (isScaleType(value)) {
              display.setScaleType(value)
            }
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
        <RangeFields display={display} />
        <div className={classes.checkboxes}>
          {rulesABand(display) && scaleType !== 'log' && !bothPinned ? (
            <LabeledCheckbox
              size="small"
              label="Include 0"
              checked={display.scaleZero}
              onChange={zero => {
                display.setScaleZero(zero)
              }}
            />
          ) : null}
          {bothPinned ? null : (
            <LabeledCheckbox
              size="small"
              label="Clip extreme outliers"
              checked={fenceQuantile < 1}
              onChange={on => {
                display.setFenceQuantile(on ? display.clipFenceQuantile : 1)
              }}
            />
          )}
          <LabeledCheckbox
            size="small"
            label="Grid lines"
            checked={display.grid}
            onChange={grid => {
              display.setGrid(grid)
            }}
          />
        </div>
      </Section>
      <ShareAxisWith display={display} />
      {rulesABand(display) ? <ReferenceLines display={display} /> : null}
      <ResetAxisButton display={display} />
    </div>
  )
})

export default observer(function ScoreAxisWidget({
  model,
}: {
  model: ScoreAxisWidgetModel
}) {
  const display = model.display as ScoreAxisDisplay | undefined
  return display ? (
    <AxisEditor key={display.id} display={display} />
  ) : (
    <Typography color="text.secondary" style={{ padding: 16 }}>
      The track this edited is no longer shown.
    </Typography>
  )
})
