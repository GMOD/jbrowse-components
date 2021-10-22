import React, { useMemo } from 'react'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { polarToCartesian } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { PropTypes as CommonPropTypes } from '@jbrowse/core/util/types/mst'
import { parseBreakend } from '@gmod/vcf'
import PropTypes from 'prop-types'

function bpToRadians(block, pos) {
  const blockStart = block.region.elided ? 0 : block.region.start
  const blockEnd = block.region.elided ? 0 : block.region.end
  const bpOffset = block.flipped ? blockEnd - pos : pos - blockStart
  const radians = bpOffset / block.bpPerRadian + block.startRadians
  return radians
}

const Chord = observer(function Chord({
  feature,
  blocksForRefs,
  radius,
  config,
  bezierRadius,
  selected,
  onClick,
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
  let endBlock
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
        onClick={evt =>
          onClick(feature, startBlock.region, endBlock.region, evt)
        }
        onMouseOver={evt => {
          if (!selected) {
            evt.target.style.stroke = hoverStrokeColor
            evt.target.style.strokeWidth = 3
          }
        }}
        onMouseOut={evt => {
          if (!selected) {
            evt.target.style.stroke = strokeColor
            evt.target.style.strokeWidth = 1
          }
        }}
      />
    )
  }

  return null
})

function StructuralVariantChords(props) {
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
    const blocksForRefs = {}
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
        displayModel={displayModel}
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

StructuralVariantChords.propTypes = {
  features: PropTypes.instanceOf(Map).isRequired,
  config: CommonPropTypes.ConfigSchema.isRequired,
  displayModel: MobxPropTypes.objectOrObservableObject,
  blockDefinitions: PropTypes.arrayOf(MobxPropTypes.objectOrObservableObject)
    .isRequired,
  radius: PropTypes.number.isRequired,
  bezierRadius: PropTypes.number.isRequired,
  selectedFeatureId: PropTypes.string,
  onChordClick: PropTypes.oneOfType([PropTypes.func, PropTypes.string]),
}

StructuralVariantChords.defaultProps = {
  displayModel: undefined,
  selectedFeatureId: '',
  onChordClick: undefined,
}

export default observer(StructuralVariantChords)
