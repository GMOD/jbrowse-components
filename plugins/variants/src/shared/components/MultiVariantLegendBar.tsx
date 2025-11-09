import { clamp, getContainingView, max, measureText } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ColorLegend from './MultiVariantColorLegend'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel'

const Wrapper = observer(function ({
  children,
  model,
  exportSVG,
}: {
  model: MultiVariantBaseModel
  children: React.ReactNode
  exportSVG?: boolean
}) {
  const { id, scrollTop, height } = model
  const clipid = `legend-${id}`
  return exportSVG ? (
    <>
      <defs>
        <clipPath id={clipid}>
          <rect x={0} y={0} width={1000} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipid})`}>
        <g transform={`translate(0,${-scrollTop})`}>{children}</g>
      </g>
    </>
  ) : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 100,
        pointerEvents: 'none',
        height: model.totalHeight,
        width: getContainingView(model).width,
      }}
    >
      {children}
    </svg>
  )
})

export const LegendBar = observer(function (props: {
  model: MultiVariantBaseModel
  orientation?: string
  exportSVG?: boolean
}) {
  const { model } = props
  const { canDisplayLabels, rowHeight, sources } = model
  const svgFontSize = clamp(rowHeight, 8, 12)
  return sources ? (
    <Wrapper {...props}>
      <ColorLegend
        model={model}
        labelWidth={max(
          sources
            .map(s => measureText(s.label, svgFontSize) + 10)
            .map(width => (canDisplayLabels ? width : 20)),
          0,
        )}
      />
    </Wrapper>
  ) : null
})

export default LegendBar
