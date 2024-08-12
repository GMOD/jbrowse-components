import React from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import ScoreText from './ScoreText'

const Lollipop = observer(function Lollipop(props: Record<string, any>) {
  const { feature, config, layoutRecord, selectedFeatureId } = props
  const {
    anchorLocation,
    y,
    data: { radiusPx },
  } = layoutRecord

  const onFeatureMouseDown = (event: React.MouseEvent) => {
    const { onFeatureMouseDown: handler, feature } = props
    return handler?.(event, feature.id())
  }

  const onFeatureMouseEnter = (event: React.MouseEvent) => {
    const { onFeatureMouseEnter: handler, feature } = props
    return handler?.(event, feature.id())
  }

  const onFeatureMouseOut = (event: React.MouseEvent | React.FocusEvent) => {
    const { onFeatureMouseOut: handler, feature } = props
    return handler?.(event, feature.id())
  }

  const onFeatureMouseOver = (event: React.MouseEvent | React.FocusEvent) => {
    const { onFeatureMouseOver: handler, feature } = props
    return handler?.(event, feature.id())
  }

  const onFeatureMouseUp = (event: React.MouseEvent) => {
    const { onFeatureMouseUp: handler, feature } = props
    return handler?.(event, feature.id())
  }

  const onFeatureMouseLeave = (event: React.MouseEvent) => {
    const { onFeatureMouseLeave: handler, feature } = props
    return handler?.(event, feature.id())
  }

  const onFeatureMouseMove = (event: React.MouseEvent) => {
    const { onFeatureMouseMove: handler, feature } = props
    return handler?.(event, feature.id())
  }

  const onFeatureClick = (event: React.MouseEvent) => {
    const { onFeatureClick: handler, feature } = props
    event.stopPropagation()
    return handler?.(event, feature.id())
  }

  const styleOuter = {
    fill: readConfObject(config, 'strokeColor', { feature }),
  }
  if (String(selectedFeatureId) === String(feature.id())) {
    styleOuter.fill = 'red'
  }

  const styleInner = {
    fill: readConfObject(config, 'innerColor', { feature }),
  }

  const strokeWidth = readConfObject(config, 'strokeWidth', { feature })

  return (
    <g data-testid={feature.id()}>
      <title>{readConfObject(config, 'caption', { feature })}</title>
      <circle
        cx={anchorLocation}
        cy={y + radiusPx}
        r={radiusPx}
        style={styleOuter}
        onMouseDown={onFeatureMouseDown}
        onMouseEnter={onFeatureMouseEnter}
        onMouseOut={onFeatureMouseOut}
        onMouseOver={onFeatureMouseOver}
        onMouseUp={onFeatureMouseUp}
        onMouseLeave={onFeatureMouseLeave}
        onMouseMove={onFeatureMouseMove}
        onClick={onFeatureClick}
        onFocus={onFeatureMouseOver}
        onBlur={onFeatureMouseOut}
      />
      {radiusPx - strokeWidth <= 2 ? null : (
        <circle
          cx={anchorLocation}
          cy={y + radiusPx}
          r={radiusPx - strokeWidth}
          style={styleInner}
          onMouseDown={onFeatureMouseDown}
          onMouseEnter={onFeatureMouseEnter}
          onMouseOut={onFeatureMouseOut}
          onMouseOver={onFeatureMouseOver}
          onMouseUp={onFeatureMouseUp}
          onMouseLeave={onFeatureMouseLeave}
          onMouseMove={onFeatureMouseMove}
          onClick={onFeatureClick}
          onFocus={onFeatureMouseOver}
          onBlur={onFeatureMouseOut}
        />
      )}
      <ScoreText
        feature={feature}
        config={config}
        layoutRecord={layoutRecord}
      />
    </g>
  )
})

export default Lollipop
