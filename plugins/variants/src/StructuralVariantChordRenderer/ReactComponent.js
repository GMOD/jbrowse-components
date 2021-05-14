const ChordRendererF = ({ jbrequire }) => {
  const React = jbrequire('react')
  const { useMemo } = jbrequire('react')
  const { observer, PropTypes: MobxPropTypes } = jbrequire('mobx-react')
  const { polarToCartesian } = jbrequire('@jbrowse/core/util')
  const { readConfObject } = jbrequire('@jbrowse/core/configuration')

  const { PropTypes: CommonPropTypes } = jbrequire(
    '@jbrowse/core/util/types/mst',
  )
  const PropTypes = jbrequire('prop-types')

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
    if (svType === 'BND') {
      // VCF BND
      const breakendSpecification = (feature.get('ALT') || [])[0]
      const matePosition = breakendSpecification.MatePosition.split(':')
      endPosition = parseInt(matePosition[1], 10)
      endBlock = blocksForRefs[matePosition[0]]
    } else if (svType === 'TRA') {
      // VCF TRA
      const chr2 = ((feature.get('INFO') || {}).CHR2 || [])[0]
      const end = ((feature.get('INFO') || {}).END || [])[0]
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

      let strokeColor
      if (selected) {
        strokeColor = readConfObject(config, 'strokeColorSelected', { feature })
      } else {
        strokeColor = readConfObject(config, 'strokeColor', { feature })
      }
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
            }
          }}
          onMouseOut={evt => {
            if (!selected) {
              evt.target.style.stroke = strokeColor
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

  return observer(StructuralVariantChords)
}

export default ChordRendererF
