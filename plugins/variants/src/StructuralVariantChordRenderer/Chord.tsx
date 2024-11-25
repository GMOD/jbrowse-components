import React, { useState } from 'react'
import { parseBreakend } from '@gmod/vcf'
import { readConfObject } from '@jbrowse/core/configuration'
import { polarToCartesian, getStrokeProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

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
  blocksForRefs: Record<string, Block>
  radius: number
  config: AnyConfigurationModel
  bezierRadius: number
  selected: boolean
  onClick: (feat: Feature, reg: AnyRegion, end: AnyRegion, evt: unknown) => void
}) {
  const [hovered, setHovered] = useState(false)
  // find the blocks that our start and end points belong to
  const startBlock = blocksForRefs[feature.get('refName')]
  if (!startBlock) {
    return null
  }
  let svType: string | undefined
  if (feature.get('INFO')) {
    ;[svType] = feature.get('INFO').SVTYPE || []
  } else if (feature.get('mate')) {
    svType = 'mate'
  }
  let endPosition: number
  let endBlock: Block | undefined
  const alt = feature.get('ALT')?.[0]
  const bnd = alt && parseBreakend(alt)
  const startPos = feature.get('start')
  if (bnd) {
    // VCF BND
    const matePosition = bnd.MatePosition.split(':')
    endPosition = +matePosition[1]
    endBlock = blocksForRefs[matePosition[0]]
  } else if (alt === '<TRA>') {
    // VCF TRA
    const chr2 = feature.get('INFO')?.CHR2?.[0]
    const end = feature.get('INFO')?.END?.[0]
    endPosition = Number.parseInt(end, 10)
    endBlock = blocksForRefs[chr2]
  } else if (svType === 'mate') {
    // generic simplefeatures arcs
    const mate = feature.get('mate')
    const chr2 = mate.refName
    endPosition = mate.start
    endBlock = blocksForRefs[chr2]
  } else {
    console.warn('unknown sv type', svType)
    endPosition = startPos + 1
  }

  if (endBlock) {
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
        cursor="crosshair"
        fill="none"
        d={['M', ...startXY, 'Q', ...controlXY, ...endXY].join(' ')}
        {...getStrokeProps(hovered ? hoverStrokeColor : strokeColor)}
        strokeWidth={hovered ? 3 : 1}
        onClick={evt => {
          onClick(feature, startBlock.region, endBlock.region, evt)
        }}
        onMouseOver={() => {
          if (!selected) {
            setHovered(true)
          }
        }}
        onMouseOut={() => {
          if (!selected) {
            setHovered(false)
          }
        }}
      />
    )
  }

  return null
})

export default Chord
