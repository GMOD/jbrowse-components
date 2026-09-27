import { useState } from 'react'

import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import {
  Checkbox,
  FormControlLabel,
  ToggleButton,
  Tooltip,
} from '@mui/material'
import { observer } from 'mobx-react'

import { keyframes, makeStyles } from '../util/tss-react/index.ts'
import { alpha } from './palette.ts'
import { SCROLL_ZOOM_HELP, SCROLL_ZOOM_LABEL } from './scrollZoomLabels.ts'

const PULSE_MS = 550
const PULSE_COUNT = 2

const useStyles = makeStyles()(theme => {
  const { palette } = theme
  const ringBase =
    palette.mode === 'dark' ? palette.accent : palette.tertiary.main
  const ringColor = alpha(ringBase, 0.7)
  const ring = keyframes`
    from { box-shadow: 0 0 0 0 ${ringColor}; }
    to { box-shadow: 0 0 0 9px ${alpha(ringBase, 0)}; }
  `
  const steadyRing = keyframes`
    from { box-shadow: 0 0 0 4px ${ringColor}; }
    to { box-shadow: 0 0 0 4px ${alpha(ringBase, 0)}; }
  `
  return {
    label: {
      position: 'relative',
      marginLeft: 0,
      marginRight: 0,
      paddingRight: 8,
      borderRadius: 4,
      whiteSpace: 'nowrap',
    },
    checkbox: {
      padding: 6,
    },
    iconButton: {
      border: 'none',
      '&.Mui-selected, &.Mui-selected:hover': {
        backgroundColor: palette.accent,
        color: palette.background.paper,
      },
    },
    pulse: {
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      pointerEvents: 'none',
      animation: `${ring} ${PULSE_MS}ms ease-out ${PULSE_COUNT}`,
      '@media (prefers-reduced-motion: reduce)': {
        animation: `${steadyRing} ${PULSE_MS * PULSE_COUNT}ms ease-out`,
      },
    },
  }
})

export interface ScrollZoomToggleModel {
  scrollZoom: boolean
  setScrollZoom: (flag: boolean) => void
}

/**
 * The header control for scroll-to-zoom, shared by every view that has one: a
 * labelled checkbox, or with `iconOnly` a button that fills when on. It rings
 * whenever the preference changes, including from a menu or the Preferences
 * dialog, so the user sees where the setting lives.
 */
const ScrollZoomToggle = observer(function ScrollZoomToggle({
  model,
  iconOnly,
}: {
  model: ScrollZoomToggleModel
  iconOnly?: boolean
}) {
  const { classes } = useStyles()
  const { scrollZoom } = model
  // `count` doubles as the restart key, since a class alone won't replay a
  // running CSS animation
  const [pulse, setPulse] = useState({ shownFor: scrollZoom, count: 0 })
  if (pulse.shownFor !== scrollZoom) {
    setPulse({ shownFor: scrollZoom, count: pulse.count + 1 })
  }
  const ring = pulse.count ? (
    <span
      key={pulse.count}
      className={classes.pulse}
      data-testid="scroll-zoom-pulse"
    />
  ) : null
  const flip = () => {
    model.setScrollZoom(!scrollZoom)
  }
  return iconOnly ? (
    <Tooltip title={SCROLL_ZOOM_HELP}>
      <ToggleButton
        data-testid="scroll-zoom-toggle"
        value="scrollZoom"
        selected={scrollZoom}
        onChange={flip}
        className={classes.iconButton}
        size="small"
      >
        <ZoomInMapIcon fontSize="small" />
        {ring}
      </ToggleButton>
    </Tooltip>
  ) : (
    <Tooltip title={SCROLL_ZOOM_HELP} describeChild>
      <FormControlLabel
        data-testid="scroll-zoom-toggle"
        className={classes.label}
        control={
          <Checkbox
            size="small"
            checked={scrollZoom}
            onChange={flip}
            className={classes.checkbox}
          />
        }
        label={
          <>
            {SCROLL_ZOOM_LABEL}
            {ring}
          </>
        }
        slotProps={{ typography: { variant: 'body2' } }}
      />
    </Tooltip>
  )
})

export default ScrollZoomToggle
