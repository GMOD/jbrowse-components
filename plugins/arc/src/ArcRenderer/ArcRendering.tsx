import React, { useState } from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Feature, Region, bpSpanPx } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// locals
import ArcTooltip from '../ArcTooltip'

function Arc({
  selectedFeatureId,
  region,
  bpPerPx,
  config,
  onFeatureClick,
  feature,
}: {
  selectedFeatureId: string
  region: Region
  config: AnyConfigurationModel
  onFeatureClick?: (event: React.MouseEvent, featureId: string) => void
  bpPerPx: number
  feature: Feature
}) {
  const [isMouseOvered, setIsMouseOvered] = useState(false)
  const [left, right] = bpSpanPx(
    feature.get('start'),
    feature.get('end'),
    region,
    bpPerPx,
  )

  const featureId = feature.id()
  let stroke = readConfObject(config, 'color', { feature })
  let textStroke = 'black'
  if (selectedFeatureId && String(selectedFeatureId) === String(feature.id())) {
    stroke = textStroke = 'red'
  }
  const label = readConfObject(config, 'label', { feature })
  const caption = readConfObject(config, 'caption', { feature })
  const strokeWidth = readConfObject(config, 'thickness', { feature }) || 1
  const height = readConfObject(config, 'height', { feature }) || 100
  const ref = React.createRef<SVGPathElement>()

  const t = 0.5
  // formula: https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B%C3%A9zier_curves
  const textYCoord =
    (1 - t) * (1 - t) * (1 - t) * 0 +
    3 * ((1 - t) * (1 - t)) * (t * height) +
    3 * (1 - t) * (t * t) * height +
    t * t * t * 0

  return (
    <g>
      <path
        d={`M ${left} 0 C ${left} ${height}, ${right} ${height}, ${right} 0`}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="transparent"
        onClick={e => onFeatureClick?.(e, featureId)}
        onMouseOver={() => setIsMouseOvered(true)}
        onMouseLeave={() => setIsMouseOvered(false)}
        ref={ref}
        pointerEvents="stroke"
      />
      {isMouseOvered ? <ArcTooltip contents={caption} /> : null}
      <text
        x={left + (right - left) / 2}
        y={textYCoord + 3}
        style={{ stroke: 'white', strokeWidth: '0.6em' }}
      >
        {label}
      </text>
      <text
        x={left + (right - left) / 2}
        y={textYCoord + 3}
        style={{ stroke: textStroke }}
      >
        {label}
      </text>
    </g>
  )
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(x, y, radius, endAngle)
  const end = polarToCartesian(x, y, radius, startAngle)

  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ')
}

function SemiCircles({
  selectedFeatureId,
  region,
  bpPerPx,
  config,
  onFeatureClick,
  feature,
}: {
  selectedFeatureId: string
  region: Region
  config: AnyConfigurationModel
  onFeatureClick?: (event: React.MouseEvent, featureId: string) => void
  bpPerPx: number
  feature: Feature
}) {
  const [isMouseOvered, setIsMouseOvered] = useState(false)
  const [left, right] = bpSpanPx(
    feature.get('start'),
    feature.get('end'),
    region,
    bpPerPx,
  )

  const featureId = feature.id()
  let stroke = readConfObject(config, 'color', { feature })
  let textStroke = 'black'
  if (selectedFeatureId && String(selectedFeatureId) === String(feature.id())) {
    stroke = textStroke = 'red'
  }
  const label = readConfObject(config, 'label', { feature })
  const caption = readConfObject(config, 'caption', { feature })
  const strokeWidth = readConfObject(config, 'thickness', { feature }) || 1
  const ref = React.createRef<SVGPathElement>()
  const textYCoord = (right - left) / 2

  return (
    <g>
      <path
        d={describeArc(
          left + (right - left) / 2,
          0,
          (right - left) / 2,
          90,
          270,
        )}
        stroke={stroke}
        strokeWidth={strokeWidth}
        fill="transparent"
        onClick={e => onFeatureClick?.(e, featureId)}
        onMouseOver={() => setIsMouseOvered(true)}
        onMouseLeave={() => setIsMouseOvered(false)}
        ref={ref}
        pointerEvents="stroke"
      />
      {isMouseOvered ? <ArcTooltip contents={caption} /> : null}
      <text
        x={left + (right - left) / 2}
        y={textYCoord + 3}
        style={{ stroke: 'white', strokeWidth: '0.6em' }}
      >
        {label}
      </text>
      <text
        x={left + (right - left) / 2}
        y={textYCoord + 3}
        style={{ stroke: textStroke }}
      >
        {label}
      </text>
    </g>
  )
}
const ArcRendering = observer(function ({
  features,
  config,
  regions,
  bpPerPx,
  height,
  exportSVG,
  displayModel: { selectedFeatureId },
}: {
  features: Map<string, Feature>
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  height: number
  displayModel: { selectedFeatureId: string }
  exportSVG: boolean
}) {
  const [region] = regions
  const width = (region.end - region.start) / bpPerPx
  const semicircles = readConfObject(config, 'displayMode') === 'semicircles'

  return (
    <Wrapper exportSVG={exportSVG} width={width} height={height}>
      {[...features.values()].map(f =>
        semicircles ? (
          <SemiCircles
            key={f.id()}
            config={config}
            region={region}
            bpPerPx={bpPerPx}
            selectedFeatureId={selectedFeatureId}
            feature={f}
          />
        ) : (
          <Arc
            key={f.id()}
            config={config}
            region={region}
            bpPerPx={bpPerPx}
            selectedFeatureId={selectedFeatureId}
            feature={f}
          />
        ),
      )}
    </Wrapper>
  )
})

function Wrapper({
  exportSVG,
  width,
  height,
  children,
}: {
  exportSVG: boolean
  width: number
  height: number
  children: React.ReactNode
}) {
  return exportSVG ? (
    <>{children}</>
  ) : (
    <svg width={width} height={height}>
      {children}
    </svg>
  )
}

export default ArcRendering
