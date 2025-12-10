import { Suspense, lazy, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { bpSpanPx, getStrokeProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'

const ArcTooltip = lazy(() => import('../ArcTooltip'))

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

function getSemicirclePath(centerX: number, radius: number) {
  const start = polarToCartesian(centerX, 0, radius, 270)
  const end = polarToCartesian(centerX, 0, radius, 90)
  return {
    d: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 0 ${end.x} ${end.y}`,
    textYCoord: radius,
  }
}

function getBezierPath(
  left: number,
  right: number,
  config: AnyConfigurationModel,
  feature: Feature,
  displayHeight: number,
) {
  const height = Math.min(
    readConfObject(config, 'height', { feature }) || 100,
    displayHeight,
  )
  // formula: https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B%C3%A9zier_curves
  const t = 0.5
  const t1 = 1 - t
  return {
    d: `M ${left} 0 C ${left} ${height}, ${right} ${height}, ${right} 0`,
    textYCoord: 3 * (t1 * t1) * (t * height) + 3 * t1 * (t * t) * height,
  }
}

function ArcFeature({
  selectedFeatureId,
  region,
  bpPerPx,
  config,
  displayHeight,
  feature,
  semicircle,
  onFeatureClick,
}: {
  selectedFeatureId?: string
  region: Region
  config: AnyConfigurationModel
  bpPerPx: number
  displayHeight: number
  feature: Feature
  semicircle: boolean
  onFeatureClick: (event: React.MouseEvent, featureId: string) => void
}) {
  const [isMouseOvered, setIsMouseOvered] = useState(false)
  const [left, right] = bpSpanPx(
    feature.get('start'),
    feature.get('end'),
    region,
    bpPerPx,
  )

  const featureId = feature.id()
  const selected = selectedFeatureId === featureId
  const stroke = selected ? 'red' : readConfObject(config, 'color', { feature })
  const textStroke = selected ? 'red' : 'black'
  const label = readConfObject(config, 'label', { feature })
  const caption = readConfObject(config, 'caption', { feature })
  const strokeWidth = readConfObject(config, 'thickness', { feature }) || 2

  const centerX = left + (right - left) / 2
  const radius = (right - left) / 2
  const { d, textYCoord } = semicircle
    ? getSemicirclePath(centerX, radius)
    : getBezierPath(left, right, config, feature, displayHeight)

  return (
    <g>
      <path
        {...getStrokeProps(stroke)}
        d={d}
        strokeWidth={strokeWidth}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onClick={e => {
          onFeatureClick(e, featureId)
        }}
        onMouseOver={() => {
          setIsMouseOvered(true)
        }}
        onMouseLeave={() => {
          setIsMouseOvered(false)
        }}
        pointerEvents="stroke"
      />
      {isMouseOvered ? (
        <Suspense fallback={null}>
          <ArcTooltip contents={caption} />
        </Suspense>
      ) : null}
      <text x={centerX} y={textYCoord + 3} stroke="white" strokeWidth="0.6em">
        {label}
      </text>
      <text x={centerX} y={textYCoord + 3} stroke={textStroke}>
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
  displayModel,
  onFeatureClick,
}: {
  features: Map<string, Feature>
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  height: number
  displayModel?: { selectedFeatureId: string }
  onFeatureClick: (event: React.MouseEvent, featureId: string) => void
  exportSVG: boolean
}) {
  const region = regions[0]!
  const width = (region.end - region.start) / bpPerPx
  const semicircle = readConfObject(config, 'displayMode') === 'semicircles'
  const { selectedFeatureId } = displayModel || {}

  const children = [...features.values()].map(f => (
    <ArcFeature
      key={f.id()}
      displayHeight={height}
      config={config}
      region={region}
      bpPerPx={bpPerPx}
      selectedFeatureId={selectedFeatureId}
      onFeatureClick={onFeatureClick}
      feature={f}
      semicircle={semicircle}
    />
  ))

  return exportSVG ? (
    children
  ) : (
    <svg width={width} height={height}>
      {children}
    </svg>
  )
})

export default ArcRendering
