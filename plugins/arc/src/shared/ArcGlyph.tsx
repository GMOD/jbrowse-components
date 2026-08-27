import { Suspense, lazy } from 'react'

import { observer } from 'mobx-react'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { Feature } from '@jbrowse/core/util'

const ArcTooltip = lazy(() => import('../ArcTooltip.tsx'))

export interface ArcStrokeEvents {
  style: { cursor: 'pointer' }
  pointerEvents: 'stroke'
  onClick: () => void
  onMouseOver: () => void
  onMouseLeave: () => void
}

// The shell both arc displays wrap their geometry in: the off-screen cull, the
// hover published through the model (so the foundation's viewport-change clear
// drops it, and the view can read it), the click that opens the feature, and
// the tooltip. The geometry — where the arc's ends land and what is drawn
// between them — is the render prop's, which is handed the events to attach to
// every stroked element.
//
// `left`/`right` are compared by min/max rather than as given: a reversed
// region lands `left` past `right`, and culling on the raw pair dropped arcs
// that were on screen. Export keeps everything so the full region is captured.
const ArcGlyph = observer(function ArcGlyph({
  model,
  feature,
  left,
  right,
  viewWidth,
  cullMargin = 0,
  tooltip,
  exportSVG,
  children,
}: {
  model: ArcDisplayModel
  feature: Feature
  left: number
  right: number
  viewWidth: number
  cullMargin?: number
  tooltip: string | undefined
  exportSVG?: boolean
  children: (hovered: boolean, events: ArcStrokeEvents) => React.ReactNode
}) {
  if (
    !exportSVG &&
    (Math.max(left, right) < -cullMargin ||
      Math.min(left, right) > viewWidth + cullMargin)
  ) {
    return null
  }
  const hovered = model.hoveredFeature === feature
  const events: ArcStrokeEvents = {
    style: { cursor: 'pointer' },
    pointerEvents: 'stroke',
    onClick: () => {
      model.selectFeature(feature)
    },
    onMouseOver: () => {
      model.setHoveredFeature(feature)
    },
    onMouseLeave: () => {
      model.clearHoveredFeature()
    },
  }
  return (
    <>
      {children(hovered, events)}
      {hovered ? (
        <Suspense fallback={null}>
          <ArcTooltip contents={tooltip} />
        </Suspense>
      ) : null}
    </>
  )
})

export default ArcGlyph
