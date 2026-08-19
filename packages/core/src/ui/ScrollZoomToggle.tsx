import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import { SCROLL_ZOOM_HELP, SCROLL_ZOOM_LABEL } from './scrollZoomLabels.ts'

const useStyles = makeStyles()({
  button: {
    border: 'none',
    textTransform: 'none',
    whiteSpace: 'nowrap',
    gap: 4,
  },
})

/**
 * What a view reads and writes to offer scroll-to-zoom. Duck-typed rather than
 * a model, like the rest of the wheel-zoom layer — every view here delegates
 * both to the session, which is where the preference lives.
 */
export interface ScrollZoomToggleModel {
  scrollZoom: boolean
  setScrollZoom: (flag: boolean) => void
}

/**
 * The persistent control for scroll-to-zoom, shared by every view that has one.
 *
 * **Carries its own label.** The prompt that teaches this gesture is transient
 * — it lingers seconds, a few times a session — so this button is the only
 * durable thing a user has to find the preference again, or turn it back off.
 * An icon alone is not findable, whichever icon: the glyph says "zoom" at best
 * and nothing at all about the wheel.
 *
 * `iconOnly` is for a header where this sits inside a run of icon buttons (the
 * comparative views), where a single labelled button reads as a mistake rather
 * than as emphasis. The tooltip carries the same words either way.
 */
const ScrollZoomToggle = observer(function ScrollZoomToggle({
  model,
  iconOnly,
}: {
  model: ScrollZoomToggleModel
  iconOnly?: boolean
}) {
  const { classes } = useStyles()
  // `describeChild` once the label is visible: MUI's default puts the title on
  // the child as its `aria-label`, which would replace the words on the button
  // with a paragraph that doesn't contain them. Described, not named.
  return (
    <Tooltip title={SCROLL_ZOOM_HELP} describeChild={!iconOnly}>
      <ToggleButton
        value="scrollZoom"
        selected={model.scrollZoom}
        onChange={() => {
          model.setScrollZoom(!model.scrollZoom)
        }}
        className={classes.button}
        size="small"
      >
        <ZoomInMapIcon fontSize="small" />
        {iconOnly ? null : SCROLL_ZOOM_LABEL}
      </ToggleButton>
    </Tooltip>
  )
})

export default ScrollZoomToggle
