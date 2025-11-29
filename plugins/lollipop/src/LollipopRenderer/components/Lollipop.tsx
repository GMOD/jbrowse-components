import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'

import ScoreText from './ScoreText'

import type { LayoutEntry } from '../Layout'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

function Circle({
  cx,
  cy,
  r,
  style,
  featureId,
  onFeatureMouseDown,
  onFeatureMouseEnter,
  onFeatureMouseOut,
  onFeatureMouseOver,
  onFeatureMouseUp,
  onFeatureMouseLeave,
  onFeatureMouseMove,
  onFeatureClick,
}: {
  cx: number
  cy: number
  r: number
  style: { fill: string }
  featureId: string
  onFeatureMouseDown?: (event: React.MouseEvent, id: string) => void
  onFeatureMouseEnter?: (event: React.MouseEvent, id: string) => void
  onFeatureMouseOut?: (
    event: React.MouseEvent | React.FocusEvent,
    id: string,
  ) => void
  onFeatureMouseOver?: (
    event: React.MouseEvent | React.FocusEvent,
    id: string,
  ) => void
  onFeatureMouseUp?: (event: React.MouseEvent, id: string) => void
  onFeatureMouseLeave?: (event: React.MouseEvent, id: string) => void
  onFeatureMouseMove?: (event: React.MouseEvent, id: string) => void
  onFeatureClick?: (event: React.MouseEvent, id: string) => void
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      style={style}
      onMouseDown={e => onFeatureMouseDown?.(e, featureId)}
      onMouseEnter={e => onFeatureMouseEnter?.(e, featureId)}
      onMouseOut={e => onFeatureMouseOut?.(e, featureId)}
      onMouseOver={e => onFeatureMouseOver?.(e, featureId)}
      onMouseUp={e => onFeatureMouseUp?.(e, featureId)}
      onMouseLeave={e => onFeatureMouseLeave?.(e, featureId)}
      onMouseMove={e => onFeatureMouseMove?.(e, featureId)}
      onClick={e => {
        e.stopPropagation()
        onFeatureClick?.(e, featureId)
      }}
      onFocus={e => onFeatureMouseOver?.(e, featureId)}
      onBlur={e => onFeatureMouseOut?.(e, featureId)}
    />
  )
}

const Lollipop = observer(function Lollipop({
  feature,
  config,
  layoutRecord,
  selectedFeatureId,
  onFeatureMouseDown,
  onFeatureMouseEnter,
  onFeatureMouseOut,
  onFeatureMouseOver,
  onFeatureMouseUp,
  onFeatureMouseLeave,
  onFeatureMouseMove,
  onFeatureClick,
}: {
  feature: Feature
  config: AnyConfigurationModel
  layoutRecord: LayoutEntry
  selectedFeatureId?: string
  onFeatureMouseDown?: (event: React.MouseEvent, id: string) => void
  onFeatureMouseEnter?: (event: React.MouseEvent, id: string) => void
  onFeatureMouseOut?: (
    event: React.MouseEvent | React.FocusEvent,
    id: string,
  ) => void
  onFeatureMouseOver?: (
    event: React.MouseEvent | React.FocusEvent,
    id: string,
  ) => void
  onFeatureMouseUp?: (event: React.MouseEvent, id: string) => void
  onFeatureMouseLeave?: (event: React.MouseEvent, id: string) => void
  onFeatureMouseMove?: (event: React.MouseEvent, id: string) => void
  onFeatureClick?: (event: React.MouseEvent, id: string) => void
}) {
  const {
    anchorLocation,
    y,
    data: { radiusPx },
  } = layoutRecord

  const featureId = feature.id()
  const strokeWidth = readConfObject(config, 'strokeWidth', { feature })
  const cx = anchorLocation
  const cy = y + radiusPx

  const handlers = {
    featureId,
    onFeatureMouseDown,
    onFeatureMouseEnter,
    onFeatureMouseOut,
    onFeatureMouseOver,
    onFeatureMouseUp,
    onFeatureMouseLeave,
    onFeatureMouseMove,
    onFeatureClick,
  }

  return (
    <g data-testid={featureId}>
      <title>{readConfObject(config, 'caption', { feature })}</title>
      <Circle
        cx={cx}
        cy={cy}
        r={radiusPx}
        style={{
          fill:
            String(selectedFeatureId) === String(featureId)
              ? 'red'
              : readConfObject(config, 'strokeColor', { feature }),
        }}
        {...handlers}
      />
      {radiusPx - strokeWidth > 2 ? (
        <Circle
          cx={cx}
          cy={cy}
          r={radiusPx - strokeWidth}
          style={{ fill: readConfObject(config, 'innerColor', { feature }) }}
          {...handlers}
        />
      ) : null}
      <ScoreText
        feature={feature}
        config={config}
        layoutRecord={layoutRecord}
      />
    </g>
  )
})

export default Lollipop
