import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getStrokeProps, polarToCartesian } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { getEndpoint } from './chordGeometry.ts'
import { bpToRadians } from '../CircularView/slices.ts'

import type { Block } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

const Chord = observer(function Chord({
  feature,
  blocksForRefs,
  radius,
  config,
  bezierRadius,
  selected,
  onClick,
}: {
  feature: Feature
  blocksForRefs: Record<string, Block>
  radius: number
  config: AnyConfigurationModel
  bezierRadius: number
  selected: boolean
  onClick: (feat: Feature) => void
}) {
  const [hovered, setHovered] = useState(false)
  const startBlock = blocksForRefs[feature.get('refName')]
  if (!startBlock) {
    return null
  }
  const startPos = feature.get('start')
  const { endBlock, endPosition } = getEndpoint(
    feature,
    blocksForRefs,
    startBlock,
  )
  if (!endBlock) {
    return null
  }
  const startRadians = bpToRadians(startBlock, startPos)
  const endRadians = bpToRadians(endBlock, endPosition)
  const [x1, y1] = polarToCartesian(radius, startRadians)
  const [x2, y2] = polarToCartesian(radius, endRadians)
  const [cx, cy] = polarToCartesian(
    bezierRadius,
    (endRadians + startRadians) / 2,
  )
  const stroke = readConfObject(
    config,
    hovered
      ? 'strokeColorHover'
      : selected
        ? 'strokeColorSelected'
        : 'strokeColor',
    { feature },
  )
  return (
    <path
      data-testid={`chord-${feature.id()}`}
      cursor="crosshair"
      fill="none"
      d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
      {...getStrokeProps(stroke)}
      strokeWidth={hovered ? 3 : 1}
      onClick={() => {
        onClick(feature)
      }}
      onPointerEnter={() => {
        setHovered(true)
      }}
      onPointerLeave={() => {
        setHovered(false)
      }}
    />
  )
})

export default Chord
