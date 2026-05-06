import { useState } from 'react'

import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import HelpIcon from '@mui/icons-material/Help'
import TuneIcon from '@mui/icons-material/Tune'
import {
  IconButton,
  Popover,
  Slider,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import SliderTooltip from './SliderTooltip.tsx'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

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
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const { autoAlpha, alpha, minAlignmentLength, effectiveAlpha } = model

  // Opacity: cubic scaling for more granularity near 0
  const sliderValue = Math.cbrt(autoAlpha ? effectiveAlpha : alpha)

  // Min length: log2 scaling. null = not dragging, derive from model.
  const [minLengthDragValue, setMinLengthDragValue] = useState<number | null>(
    null,
  )
  const minLengthValue =
    minLengthDragValue ?? Math.log2(Math.max(1, minAlignmentLength)) * 100

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
            <Tooltip title="Auto-scale opacity based on feature count">
              <Switch
                size="small"
                checked={autoAlpha}
                onChange={(_, checked) => {
                  model.setAutoAlpha(checked)
                }}
              />
            </Tooltip>
            <Slider
              disabled={autoAlpha}
              value={sliderValue}
              onChange={(_, value) => {
                const v = typeof value === 'number' ? value : value[0]
                model.setAlpha(v ** 3)
              }}
              min={0}
              max={1}
              step={0.01}
              valueLabelDisplay="auto"
              size="small"
              slots={{ valueLabel: SliderTooltip }}
              valueLabelFormat={(v: number) =>
                (autoAlpha ? effectiveAlpha : v ** 3).toFixed(3)
              }
            />
          </div>
          <div className={classes.row}>
            <Typography variant="body2" className={classes.label}>
              Min length:
            </Typography>
            <Slider
              value={minLengthValue}
              onChange={(_, val) => {
                setMinLengthDragValue(val)
              }}
              onChangeCommitted={() => {
                setMinLengthDragValue(null)
                model.setMinAlignmentLength(
                  Math.round(2 ** (minLengthValue / 100)),
                )
              }}
              min={0}
              max={Math.log2(1000000) * 100}
              valueLabelDisplay="auto"
              valueLabelFormat={val => toLocale(Math.round(2 ** (val / 100)))}
              size="small"
              slots={{ valueLabel: SliderTooltip }}
            />
          </div>
          <div className={classes.row}>
            <Typography variant="body2" className={classes.label}>
              Overdraw:
              <Tooltip
                title="Extra pixels drawn beyond the visible area. Higher values keep off-screen synteny lines visible when scrolling, but may reduce performance."
                arrow
              >
                <HelpIcon sx={{ fontSize: '0.875rem', ml: 0.5 }} />
              </Tooltip>
            </Typography>
            <Slider
              value={model.overdrawPx}
              onChange={(_, val) => {
                model.setOverdrawPx(val)
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
        </div>
      </Popover>
    </>
  )
})

export default SyntenySettingsPopover
