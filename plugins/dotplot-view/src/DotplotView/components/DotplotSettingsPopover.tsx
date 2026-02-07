import { useEffect, useState } from 'react'

import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import TuneIcon from '@mui/icons-material/Tune'
import { IconButton, Popover, Slider, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SliderTooltip from './SliderTooltip.tsx'

import type { DotplotDisplayModel } from '../../DotplotDisplay/stateModelFactory.tsx'
import type { DotplotViewModel } from '../model.ts'

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

const DotplotSettingsPopover = observer(function DotplotSettingsPopover({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const firstDisplay = model.tracks[0]?.displays[0] as
    | DotplotDisplayModel
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

  return (
    <>
      <IconButton
        onClick={e => {
          setAnchorEl(e.currentTarget)
        }}
        title="Dotplot display settings"
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
                for (const track of model.tracks) {
                  for (const display of track.displays) {
                    ;(display as DotplotDisplayModel).setAlpha(newAlpha)
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
                for (const track of model.tracks) {
                  for (const display of track.displays) {
                    ;(display as DotplotDisplayModel).setMinAlignmentLength(
                      newMinLength,
                    )
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
        </div>
      </Popover>
    </>
  )
})

export default DotplotSettingsPopover
