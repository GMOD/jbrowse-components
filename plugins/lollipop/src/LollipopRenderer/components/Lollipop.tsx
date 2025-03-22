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
        onMouseDown={(event: React.MouseEvent) => {
          const { onFeatureMouseDown: handler, feature } = props
          return handler?.(event, feature.id())
        }}
        onMouseEnter={(event: React.MouseEvent) => {
          const { onFeatureMouseEnter: handler, feature } = props
          return handler?.(event, feature.id())
        }}
        onMouseOut={(event: React.MouseEvent | React.FocusEvent) => {
          const { onFeatureMouseOut: handler, feature } = props
          return handler?.(event, feature.id())
        }}
        onMouseOver={(event: React.MouseEvent | React.FocusEvent) => {
          const { onFeatureMouseOver: handler, feature } = props
          return handler?.(event, feature.id())
        }}
        onMouseUp={(event: React.MouseEvent) => {
          const { onFeatureMouseUp: handler, feature } = props
          return handler?.(event, feature.id())
        }}
        onMouseLeave={(event: React.MouseEvent) => {
          const { onFeatureMouseLeave: handler, feature } = props
          return handler?.(event, feature.id())
        }}
        onMouseMove={(event: React.MouseEvent) => {
          const { onFeatureMouseMove: handler, feature } = props
          return handler?.(event, feature.id())
        }}
        onClick={(event: React.MouseEvent) => {
          const { onFeatureClick: handler, feature } = props
          event.stopPropagation()
          return handler?.(event, feature.id())
        }}
        onFocus={(event: React.MouseEvent | React.FocusEvent) => {
          const { onFeatureMouseOver: handler, feature } = props
          return handler?.(event, feature.id())
        }}
        onBlur={(event: React.MouseEvent | React.FocusEvent) => {
          const { onFeatureMouseOut: handler, feature } = props
          return handler?.(event, feature.id())
        }}
      />
      {radiusPx - strokeWidth <= 2 ? null : (
        <circle
          cx={anchorLocation}
          cy={y + radiusPx}
          r={radiusPx - strokeWidth}
          style={styleInner}
          onMouseDown={(event: React.MouseEvent) => {
            const { onFeatureMouseDown: handler, feature } = props
            return handler?.(event, feature.id())
          }}
          onMouseEnter={(event: React.MouseEvent) => {
            const { onFeatureMouseEnter: handler, feature } = props
            return handler?.(event, feature.id())
          }}
          onMouseOut={(event: React.MouseEvent | React.FocusEvent) => {
            const { onFeatureMouseOut: handler, feature } = props
            return handler?.(event, feature.id())
          }}
          onMouseOver={(event: React.MouseEvent | React.FocusEvent) => {
            const { onFeatureMouseOver: handler, feature } = props
            return handler?.(event, feature.id())
          }}
          onMouseUp={(event: React.MouseEvent) => {
            const { onFeatureMouseUp: handler, feature } = props
            return handler?.(event, feature.id())
          }}
          onMouseLeave={(event: React.MouseEvent) => {
            const { onFeatureMouseLeave: handler, feature } = props
            return handler?.(event, feature.id())
          }}
          onMouseMove={(event: React.MouseEvent) => {
            const { onFeatureMouseMove: handler, feature } = props
            return handler?.(event, feature.id())
          }}
          onClick={(event: React.MouseEvent) => {
            const { onFeatureClick: handler, feature } = props
            event.stopPropagation()
            return handler?.(event, feature.id())
          }}
          onFocus={(event: React.MouseEvent | React.FocusEvent) => {
            const { onFeatureMouseOver: handler, feature } = props
            return handler?.(event, feature.id())
          }}
          onBlur={(event: React.MouseEvent | React.FocusEvent) => {
            const { onFeatureMouseOut: handler, feature } = props
            return handler?.(event, feature.id())
          }}
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
