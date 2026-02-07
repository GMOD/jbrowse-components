import { useEffect, useState } from 'react'

import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import TuneIcon from '@mui/icons-material/Tune'
import { IconButton, Popover, Slider, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SliderTooltip from './SliderTooltip.tsx'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  content: {
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    width: 250,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  label: {
    whiteSpace: 'nowrap',
    minWidth: 80,
  },
}))

const SyntenySettingsPopover = observer(function SyntenySettingsPopover({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { levels } = model
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const firstDisplay = levels[0]?.tracks[0]?.displays[0] as
    | LinearSyntenyDisplayModel
    | undefined

  const alpha = firstDisplay?.alpha ?? 1
  const minAlignmentLength = firstDisplay?.minAlignmentLength ?? 0

  // Opacity: cubic scaling for more granularity near 0
  const exponent = 3
  const alphaToSlider = (a: number) => Math.pow(a, 1 / exponent)
  const sliderToAlpha = (s: number) => Math.pow(s, exponent)
  const sliderValue = alphaToSlider(alpha)

  // Min length: log2 scaling
  const [minLengthValue, setMinLengthValue] = useState(
    Math.log2(Math.max(1, minAlignmentLength)) * 100,
  )

  useEffect(() => {
    setMinLengthValue(Math.log2(Math.max(1, minAlignmentLength)) * 100)
  }, [minAlignmentLength])

  const view = model as unknown as LinearSyntenyViewModel
  const hasOffScreen = 'maxOffScreenDrawPx' in view

  return (
    <>
      <IconButton
        onClick={e => {
          setAnchorEl(e.currentTarget)
        }}
        title="Synteny display settings"
      >
        <TuneIcon />
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <div className={classes.content}>
          <div className={classes.row}>
            <Typography variant="body2" className={classes.label}>
              Opacity:
            </Typography>
            <Slider
              value={sliderValue}
              onChange={(_, value) => {
                const v = typeof value === 'number' ? value : value[0]!
                const newAlpha = sliderToAlpha(v)
                for (const level of levels) {
                  for (const track of level.tracks) {
                    for (const display of track.displays) {
                      ;(display as LinearSyntenyDisplayModel).setAlpha(newAlpha)
                    }
                  }
                }
              }}
              min={0}
              max={1}
              step={0.01}
              valueLabelDisplay="auto"
              size="small"
              slots={{ valueLabel: SliderTooltip }}
              valueLabelFormat={(v: number) => sliderToAlpha(v).toFixed(3)}
            />
          </div>
          <div className={classes.row}>
            <Typography variant="body2" className={classes.label}>
              Min length:
            </Typography>
            <Slider
              value={minLengthValue}
              onChange={(_, val) => {
                setMinLengthValue(val as number)
              }}
              onChangeCommitted={() => {
                const newMinLength = Math.round(2 ** (minLengthValue / 100))
                for (const level of levels) {
                  for (const track of level.tracks) {
                    for (const display of track.displays) {
                      ;(
                        display as LinearSyntenyDisplayModel
                      ).setMinAlignmentLength(newMinLength)
                    }
                  }
                }
              }}
              min={0}
              max={Math.log2(1000000) * 100}
              valueLabelDisplay="auto"
              valueLabelFormat={val =>
                toLocale(Math.round(2 ** (val / 100)))
              }
              size="small"
              slots={{ valueLabel: SliderTooltip }}
            />
          </div>
          {hasOffScreen ? (
            <div className={classes.row}>
              <Typography variant="body2" className={classes.label}>
                Off-screen:
              </Typography>
              <Slider
                value={view.maxOffScreenDrawPx}
                onChange={(_, val) => {
                  view.setMaxOffScreenDrawPx(val as number)
                }}
                min={0}
                max={10000}
                step={100}
                valueLabelDisplay="auto"
                size="small"
                valueLabelFormat={(val: number) => `${val}px`}
                slots={{ valueLabel: SliderTooltip }}
              />
            </div>
          ) : null}
        </div>
      </Popover>
    </>
  )
})

export default SyntenySettingsPopover
