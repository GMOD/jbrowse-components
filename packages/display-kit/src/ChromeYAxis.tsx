import { Fragment } from 'react'

import {
  CrossHatches,
  SCORE_CAPTION_HEIGHT,
  ScoreDomainCaption,
  ScoreRules,
  YScaleBarOverlay,
  axisDrawn,
} from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { captionedAxes } from './axisHost.ts'

import type { AxisHost } from './axisHost.ts'

/**
 * The on-screen y axes of a display declaring value scales, drawn by the
 * chrome off the ticks the mixin derived so no display places its own. For
 * each scale, once per band it rules that is on screen: the guide lines
 * across the band when the display shows them, the rules the reader placed
 * over those, and the labelled axis in its gutter over both. A scale whose bands are too short
 * for an axis is captioned `[min, max]` once at the top-right instead, and
 * the legend starts below the captions. Its own observer, so a domain that
 * moves on every fetch re-renders the axes and not the chrome around it.
 */
const ChromeYAxis = observer(function ChromeYAxis({
  model,
}: {
  model: AxisHost
}) {
  const {
    axes,
    height,
    canvasWidthPx: width,
    showCrossHatches,
    scoreRuleMarks = [],
  } = model
  if (axes.length === 0) {
    return null
  }
  const captioned = captionedAxes(model)
  return (
    <>
      {axes.map((axis, i) => {
        const bandTops = (axis.bandTops ?? [0]).filter(
          top => top + axis.height >= 0 && top <= height,
        )
        const fits = axisDrawn(axis)
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- the scales are declared in a fixed order
          <Fragment key={i}>
            {showCrossHatches && fits ? (
              <CrossHatches
                ticks={axis.ticks}
                width={width}
                height={height}
                bandTops={bandTops}
              />
            ) : null}
            {scoreRuleMarks.length > 0 ? (
              <ScoreRules
                marks={scoreRuleMarks}
                width={width}
                height={height}
                bandTops={bandTops}
              />
            ) : null}
            {fits
              ? bandTops.map(top => (
                  <YScaleBarOverlay
                    key={top}
                    axis={axis}
                    top={top}
                    width={width}
                  />
                ))
              : null}
          </Fragment>
        )
      })}
      {captioned.length > 0 ? (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            height: captioned.length * SCORE_CAPTION_HEIGHT,
            width,
          }}
        >
          {captioned.map((axis, i) => (
            <g
              // eslint-disable-next-line @eslint-react/no-array-index-key -- stacked in declaration order
              key={i}
              transform={`translate(0 ${i * SCORE_CAPTION_HEIGHT})`}
            >
              <ScoreDomainCaption
                domain={axis.domain}
                scaleType={axis.scaleType}
                canvasWidth={width}
              />
            </g>
          ))}
        </svg>
      ) : null}
    </>
  )
})

export default ChromeYAxis
