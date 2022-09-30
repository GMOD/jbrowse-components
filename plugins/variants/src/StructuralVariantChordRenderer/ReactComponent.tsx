import React, { useMemo } from 'react'
import { observer } from 'mobx-react'
import { polarToCartesian, Feature } from '@jbrowse/core/util'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { parseBreakend } from '@gmod/vcf'

interface Region {
  end: number
  start: number
  refName: string
  elided?: false
}

interface ElidedRegion {
  elided: true
  regions: Region[]
}

type AnyRegion = Region | ElidedRegion

interface Block {
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
            // @ts-ignore
            evt.target.style.stroke = hoverStrokeColor
            // @ts-ignore
            evt.target.style.strokeWidth = 3
          }
        }}
        onMouseOut={evt => {
          if (!selected) {
            // @ts-ignore
            evt.target.style.stroke = strokeColor
            // @ts-ignore
            evt.target.style.strokeWidth = 1
          }
        }}
      />
    )
  }

  return null
})

function StructuralVariantChords(props: {
  features: Map<string, Feature>
  radius: number
  config: AnyConfigurationModel
  displayModel: { id: string; selectedFeatureId: string }
  blockDefinitions: Block[]
  bezierRadius: number
  onChordClick: (
    feature: Feature,
    reg: AnyRegion,
    endBlock: AnyRegion,
    evt: unknown,
  ) => void
}) {
  const {
    features,
    config,
    displayModel,
    blockDefinitions,
    radius,
    bezierRadius,
    displayModel: { selectedFeatureId },
    onChordClick,
  } = props
  // make a map of refName -> blockDefinition
  const blocksForRefsMemo = useMemo(() => {
    const blocksForRefs = {} as { [key: string]: Block }
    blockDefinitions.forEach(block => {
      const regions = block.region.elided
        ? block.region.regions
        : [block.region]
      regions.forEach(region => {
        blocksForRefs[region.refName] = block
      })
    })
    return blocksForRefs
  }, [blockDefinitions])
  // console.log(blocksForRefs)
  const chords = []
  for (const [id, feature] of features) {
    const selected = String(selectedFeatureId) === String(feature.id())
    chords.push(
      <Chord
        key={id}
        feature={feature}
        config={config}
        radius={radius}
        bezierRadius={bezierRadius}
        blocksForRefs={blocksForRefsMemo}
        selected={selected}
        onClick={onChordClick}
      />,
    )
  }
  const trackStyleId = `chords-${displayModel.id}`
  return (
    <g id={trackStyleId} data-testid="structuralVariantChordRenderer">
      <style
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
          #${trackStyleId} > path {
            cursor: crosshair;
            fill: none;
          }
`,
        }}
      />
      {chords}
    </g>
  )
}

export default observer(StructuralVariantChords)
