export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { observer } = jbrequire('mobx-react')
  const { polarToCartesian } = jbrequire('@gmod/jbrowse-core/util')

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
    bezierRadius,
  }) {
    // find the blocks that our start and end points belong to
    const startBlock = blocksForRefs[feature.get('refName')]
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
        return (
          <path
            d={['M', ...startXY, 'Q', ...controlXY, ...endXY].join(' ')}
            stroke="black"
            fill="transparent"
          />
        )
      }
    }

    return null
  })

  function StructuralVariantChords(props) {
    // console.log(props)
    const {
      features,
      config,
      trackModel,
      blockDefinitions,
      radius,
      bezierRadius,
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
      chords.push(
        <Chord
          key={id}
          feature={feature}
          config={config}
          trackModel={trackModel}
          radius={radius}
          bezierRadius={bezierRadius}
          blocksForRefs={blocksForRefs}
        />,
      )
    }
    return <>{chords}</>
  }

  return observer(StructuralVariantChords)
}
