export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { observer, PropTypes: MobxPropTypes } = jbrequire('mobx-react')
  const { polarToCartesian } = jbrequire('@gmod/jbrowse-core/util')
  const { readConfObject } = jbrequire('@gmod/jbrowse-core/configuration')

  const { PropTypes: CommonPropTypes } = jbrequire(
    '@gmod/jbrowse-core/mst-types',
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
    trackModel,
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
    const svType = ((feature.get('INFO') || {}).SVTYPE || [])[0]
    if (svType === 'BND') {
      const breakendSpecification = (feature.get('ALT') || [])[0]
      const matePosition = breakendSpecification.MatePosition.split(':')
      matePosition[1] = parseInt(matePosition[1], 10)
      const endBlock = blocksForRefs[matePosition[0]]
      if (endBlock) {
        const startPos = feature.get('start')
        const startRadians = bpToRadians(startBlock, startPos)
        const endRadians = bpToRadians(endBlock, matePosition[1])
        const startXY = polarToCartesian(radius, startRadians)
        const endXY = polarToCartesian(radius, endRadians)
        const controlXY = polarToCartesian(
          bezierRadius,
          (endRadians + startRadians) / 2,
        )

        let strokeColor
        if (selected) {
          strokeColor = readConfObject(config, 'strokeColorSelected', [feature])
        } else {
          strokeColor = readConfObject(config, 'strokeColor', [feature])
        }
        const hoverStrokeColor = readConfObject(config, 'strokeColorHover', [
          feature,
        ])
        return (
          <path
            d={['M', ...startXY, 'Q', ...controlXY, ...endXY].join(' ')}
            style={{ stroke: strokeColor }}
            onClick={evt => onClick(feature, evt)}
            onMouseOver={evt => {
              if (!selected) evt.target.style.stroke = hoverStrokeColor
            }}
            onMouseOut={evt => {
              if (!selected) evt.target.style.stroke = strokeColor
            }}
          />
        )
      }
    }

    return null
  })

  function StructuralVariantChords(props) {
    const {
      features,
      config,
      trackModel,
      blockDefinitions,
      radius,
      bezierRadius,
      trackModel: { selectedFeatureId },

      onChordClick,
    } = props
    // make a map of refName -> blockDefinition
    const blocksForRefs = {}
    blockDefinitions.forEach(block => {
      const regions = block.region.elided
        ? block.region.regions
        : [block.region]
      regions.forEach(region => {
        blocksForRefs[region.refName] = block
      })
    })
    // console.log(blocksForRefs)
    const chords = []
    for (const [id, feature] of features) {
      const selected = String(selectedFeatureId) === String(feature.id())
      chords.push(
        <Chord
          key={id}
          feature={feature}
          config={config}
          trackModel={trackModel}
          radius={radius}
          bezierRadius={bezierRadius}
          blocksForRefs={blocksForRefs}
          selected={selected}
          onClick={onChordClick}
        />,
      )
    }
    const trackStyleId = `chords-${trackModel.id}`
    return (
      <g id={trackStyleId}>
        <style
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
    trackModel: MobxPropTypes.objectOrObservableObject,
    blockDefinitions: PropTypes.arrayOf(MobxPropTypes.objectOrObservableObject)
      .isRequired,
    radius: PropTypes.number.isRequired,
    bezierRadius: PropTypes.number.isRequired,
    selectedFeatureId: PropTypes.string,
  }

  StructuralVariantChords.defaultProps = {
    trackModel: undefined,
    selectedFeatureId: '',
  }

  return observer(StructuralVariantChords)
}
