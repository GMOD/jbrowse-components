import { CrossHatches, ScoreRules, YScaleBarOverlay } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { axisTicks } from './axisHost.ts'

import type { AxisHost } from './axisHost.ts'

/**
 * The on-screen y axis of a display composing `ScoreScaleMixin` with a
 * `valueScale`, drawn by the chrome off the ticks the mixin derived so no
 * display places its own: the guide lines across the plot when the display
 * shows them, the rules the reader placed over those, and the labelled axis
 * indented from the left edge over both. Its own observer, so a domain that
 * moves on every fetch re-renders the axis and not the chrome around it.
 */
const ChromeYAxis = observer(function ChromeYAxis({
  model,
}: {
  model: AxisHost
}) {
  const ticks = axisTicks(model)
  if (!ticks) {
    return null
  }
  const {
    height,
    canvasWidthPx: width,
    showCrossHatches,
    scoreRuleMarks = [],
  } = model
  return (
    <>
      {showCrossHatches ? (
        <CrossHatches ticks={ticks} width={width} height={height} />
      ) : null}
      {scoreRuleMarks.length > 0 ? (
        <ScoreRules marks={scoreRuleMarks} width={width} height={height} />
      ) : null}
      <YScaleBarOverlay ticks={ticks} height={height} width={width} />
    </>
  )
})

export default ChromeYAxis
