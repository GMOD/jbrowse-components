import React from 'react'
import { measureText, getContainingView } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

// locals
import { WiggleDisplayModel } from '../models/model'
import YScaleBar from '../../shared/YScaleBar'
import ColorLegend from './ColorLegend'
import ScoreLegend from './ScoreLegend'
import { getOffset } from './util'

type LGV = LinearGenomeViewModel

const Wrapper = observer(function ({
  children,
  model,
  exportSVG,
}: {
  model: WiggleDisplayModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  if (exportSVG) {
    return <>{children}</>
  } else {
    const { height } = model
    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          height,
          width: getContainingView(model).width,
        }}
      >
        {children}
      </svg>
    )
  }
})

export const YScaleBars = observer(function (props: {
  model: WiggleDisplayModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { model, orientation, exportSVG } = props
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
          <g transform={`translate(${!exportSVG ? getOffset(model) : 0},0)`}>
            <YScaleBar model={model} orientation={orientation} />
          </g>
          <g transform={`translate(${viewWidth - labelWidth - 100},0)`}>
            <ColorLegend
              exportSVG={exportSVG}
              model={model}
              rowHeight={12}
              labelWidth={labelWidth}
            />
          </g>
        </>
      ) : (
        <>
          <ColorLegend
            exportSVG={exportSVG}
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
                key={`${JSON.stringify(ticks)}-${idx}`}
              >
                <YScaleBar model={model} orientation={orientation} />
              </g>
            ))
          )}
        </>
      )}
    </Wrapper>
  )
})

export default YScaleBars
