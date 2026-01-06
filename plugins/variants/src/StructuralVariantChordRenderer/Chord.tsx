import { useState } from 'react'

import { parseBreakend } from '@gmod/vcf'
import { readConfObject } from '@jbrowse/core/configuration'
import { getStrokeProps, polarToCartesian } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { AnyRegion, Block } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

function bpToRadians(block: Block, pos: number) {
  const blockStart = block.region.elided ? 0 : block.region.start
  const blockEnd = block.region.elided ? 0 : block.region.end
  const bpOffset = block.flipped ? blockEnd - pos : pos - blockStart
  return bpOffset / block.bpPerRadian + block.startRadians
}

function getEndpoint(
  feature: Feature,
  blocksForRefs: Record<string, Block>,
  startBlock: Block,
) {
  const alt = feature.get('ALT')?.[0]
  const bnd = alt && parseBreakend(alt)
  const mate = feature.get('mate')
  if (bnd) {
    const [chr, pos] = bnd.MatePosition.split(':')
    return { endBlock: blocksForRefs[chr], endPosition: +pos }
  } else if (alt === '<TRA>') {
    const chr2 = feature.get('INFO')?.CHR2?.[0]
    const end = feature.get('INFO')?.END?.[0]
    return {
      endBlock: blocksForRefs[chr2],
      endPosition: Number.parseInt(end, 10),
    }
  } else if (mate) {
    return { endBlock: blocksForRefs[mate.refName], endPosition: mate.start }
  }
  return { endBlock: startBlock, endPosition: feature.get('end') }
}

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
  onClick: (feat: Feature, reg: AnyRegion, end: AnyRegion, evt: unknown) => void
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
      onClick={evt => {
        onClick(feature, startBlock.region, endBlock.region, evt)
      }}
      onMouseOver={() => {
        setHovered(true)
      }}
      onMouseOut={() => {
        setHovered(false)
      }}
    />
  )
})

export default Chord
