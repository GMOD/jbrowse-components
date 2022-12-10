import React from 'react'
import { observer } from 'mobx-react'
import { polarToCartesian, Feature } from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { parseBreakend } from '@gmod/vcf'

export interface Region {
  end: number
  start: number
  refName: string
  elided?: false
}

export interface ElidedRegion {
  elided: true
  regions: Region[]
}

export type AnyRegion = Region | ElidedRegion

export interface Block {
  flipped: boolean
  bpPerRadian: number
  startRadians: number
  region: AnyRegion
}

function bpToRadians(block: Block, pos: number) {
  const blockStart = block.region.elided ? 0 : block.region.start
  const blockEnd = block.region.elided ? 0 : block.region.end
  const bpOffset = block.flipped ? blockEnd - pos : pos - blockStart
  return bpOffset / block.bpPerRadian + block.startRadians
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
  blocksForRefs: { [key: string]: Block }
  radius: number
  config: AnyConfigurationModel
  bezierRadius: number
  selected: boolean
  onClick: (
    feature: Feature,
    reg: AnyRegion,
    endBlock: AnyRegion,
    evt: unknown,
  ) => void
}) {
  // find the blocks that our start and end points belong to
  const startBlock = blocksForRefs[feature.get('refName')]
  if (!startBlock) {
    return null
  }
  let svType
  if (feature.get('INFO')) {
    ;[svType] = feature.get('INFO').SVTYPE || []
  } else if (feature.get('mate')) {
    svType = 'mate'
  }
  let endPosition
  let endBlock: Block | undefined
  const alt = feature.get('ALT')?.[0]
  const bnd = alt && parseBreakend(alt)
  if (bnd) {
    // VCF BND
    const matePosition = bnd.MatePosition.split(':')
    endPosition = +matePosition[1]
    endBlock = blocksForRefs[matePosition[0]]
  } else if (alt === '<TRA>') {
    // VCF TRA
    const chr2 = feature.get('INFO')?.CHR2?.[0]
    const end = feature.get('INFO')?.END?.[0]
    endPosition = parseInt(end, 10)
    endBlock = blocksForRefs[chr2]
  } else if (svType === 'mate') {
    // generic simplefeatures arcs
    const mate = feature.get('mate')
    const chr2 = mate.refName
    endPosition = mate.start
    endBlock = blocksForRefs[chr2]
  }

  if (endBlock) {
    const startPos = feature.get('start')
    const startRadians = bpToRadians(startBlock, startPos)
    const endRadians = bpToRadians(endBlock, endPosition)
    const startXY = polarToCartesian(radius, startRadians)
    const endXY = polarToCartesian(radius, endRadians)
    const controlXY = polarToCartesian(
      bezierRadius,
      (endRadians + startRadians) / 2,
    )

    const strokeColor = selected
      ? readConfObject(config, 'strokeColorSelected', { feature })
      : readConfObject(config, 'strokeColor', { feature })

    const hoverStrokeColor = readConfObject(config, 'strokeColorHover', {
      feature,
    })
    return (
      <path
        data-testid={`chord-${feature.id()}`}
        d={['M', ...startXY, 'Q', ...controlXY, ...endXY].join(' ')}
        style={{ stroke: strokeColor }}
        onClick={evt => {
          if (endBlock && startBlock) {
            onClick(feature, startBlock.region, endBlock.region, evt)
          }
        }}
        onMouseOver={evt => {
          if (!selected) {
            evt.currentTarget.style.stroke = hoverStrokeColor
            evt.currentTarget.style.strokeWidth = '3px'
          }
        }}
        onMouseOut={evt => {
          if (!selected) {
            evt.currentTarget.style.stroke = strokeColor
            evt.currentTarget.style.strokeWidth = '1px'
          }
        }}
      />
    )
  }

  return null
})

export default Chord
