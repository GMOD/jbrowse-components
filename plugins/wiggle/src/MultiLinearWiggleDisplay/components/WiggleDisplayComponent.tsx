import React from 'react'
import {
  measureText,
  getContainingView,
  getContainingTrack,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import {
  LinearGenomeViewModel,
  BaseLinearDisplayComponent,
} from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// locals
import { WiggleDisplayModel } from '../models/model'
import YScaleBar from './YScaleBar'

type LGV = LinearGenomeViewModel

const trackLabelFontSize = 12.8

const Wrapper = observer(
  ({
    children,
    model,
    exportSVG,
  }: {
    model: WiggleDisplayModel
    children: React.ReactNode
    exportSVG?: boolean
  }) => {
    if (exportSVG) {
      return <>{children}</>
    } else {
      const { height, prefersOffset } = model
      const { trackLabels } = getContainingView(model) as LGV
      const track = getContainingTrack(model)
      const trackName = getConf(track, 'name')
      const left =
        trackLabels === 'overlapping' && !prefersOffset
          ? measureText(trackName, trackLabelFontSize) + 100
          : 10
      return (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left,
            pointerEvents: 'none',
            height,
            width: 1800,
          }}
        >
          {children}
        </svg>
      )
    }
  },
)

const RectBg = (props: {
  x: number
  y: number
  width: number
  height: number
  color?: string
}) => {
  const { color = 'rgb(255,255,255,0.8)' } = props
  return <rect {...props} fill={color} />
}

const ScoreLegend = observer(({ model }: { model: WiggleDisplayModel }) => {
  const { ticks, scaleType } = model
  const { width } = getContainingView(model) as LGV
  const legend =
    `[${ticks.values[0]}-${ticks.values[1]}]` +
    (scaleType === 'log' ? ' (log scale)' : '')
  const len = measureText(legend, 14)
  const padding = 25
  const xpos = width - len - padding
  return (
    <>
      <RectBg y={0} x={xpos} width={len + 6} height={16} />
      <text y={13} x={xpos}>
        {legend}
      </text>
    </>
  )
})

const ColorLegend = observer(
  ({
    model,
    rowHeight,
    labelWidth,
  }: {
    model: WiggleDisplayModel
    rowHeight: number
    labelWidth: number
  }) => {
    const {
      needsCustomLegend,
      needsScalebar,
      rowHeightTooSmallForScalebar,
      renderColorBoxes,
      sources,
    } = model
    const svgFontSize = Math.min(rowHeight, 12)
    const canDisplayLabel = rowHeight > 11

    return sources ? (
      <>
        {sources.map((source, idx) => {
          // put the subtrack labels to the right of the scalebar
          const extraOffset =
            needsScalebar && !rowHeightTooSmallForScalebar ? 50 : 0
          const colorBoxWidth = renderColorBoxes ? 15 : 0
          const legendWidth = labelWidth + colorBoxWidth + 5
          const boxHeight = Math.min(20, rowHeight)

          return (
            <React.Fragment key={source.name + '-' + idx}>
              <RectBg
                y={idx * rowHeight + 1}
                x={extraOffset}
                width={legendWidth}
                height={boxHeight}
              />
              {source.color ? (
                <RectBg
                  y={idx * rowHeight + 1}
                  x={extraOffset}
                  width={colorBoxWidth}
                  height={needsCustomLegend ? rowHeight : boxHeight}
                  color={source.color}
                />
              ) : null}
              {canDisplayLabel ? (
                <text
                  y={idx * rowHeight + 13}
                  x={extraOffset + colorBoxWidth + 2}
                  fontSize={svgFontSize}
                >
                  {source.name}
                </text>
              ) : null}
            </React.Fragment>
          )
        })}
      </>
    ) : null
  },
)

export const StatBars = observer(
  (props: {
    model: WiggleDisplayModel
    orientation?: string
    exportSVG?: boolean
  }) => {
    const { model, orientation } = props
    const {
      stats,
      needsCustomLegend,
      needsFullHeightScalebar,
      rowHeightTooSmallForScalebar,
      rowHeight,
      sources,
      ticks,
    } = model
    const svgFontSize = Math.min(rowHeight, 12)
    const canDisplayLabel = rowHeight > 11
    const { width: viewWidth } = getContainingView(model) as LGV
    const minWidth = 20

    const ready = stats && sources
    if (!ready) {
      return null
    }

    const labelWidth = Math.max(
      ...(sources
        .map(s => measureText(s.name, svgFontSize))
        .map(width => (canDisplayLabel ? width : minWidth)) || [0]),
    )

    return (
      <Wrapper {...props}>
        {needsFullHeightScalebar ? (
          <>
            <YScaleBar model={model} orientation={orientation} />
            <g transform={`translate(${viewWidth - labelWidth - 100},0)`}>
              <ColorLegend
                model={model}
                rowHeight={12}
                labelWidth={labelWidth}
              />
            </g>
          </>
        ) : (
          <>
            <ColorLegend
              model={model}
              rowHeight={model.rowHeight}
              labelWidth={labelWidth}
            />

            {rowHeightTooSmallForScalebar || needsCustomLegend ? (
              <ScoreLegend {...props} />
            ) : (
              sources.map((_source, idx) => (
                <g
                  transform={`translate(0 ${rowHeight * idx})`}
                  key={JSON.stringify(ticks) + '-' + idx}
                >
                  <YScaleBar model={model} orientation={orientation} />
                </g>
              ))
            )}
          </>
        )}
      </Wrapper>
    )
  },
)

const LinearWiggleDisplay = observer((props: { model: WiggleDisplayModel }) => {
  const { model } = props

  return (
    <div>
      <BaseLinearDisplayComponent {...props} />
      <StatBars model={model} />
    </div>
  )
})

export default LinearWiggleDisplay

export { YScaleBar }
