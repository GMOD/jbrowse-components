export default ({ jbrequire }) => {
  const React = jbrequire('react')
  return function StructuralVariantChords(props) {
    // console.log(props)
    const { features } = props
    return <text>got {features.size} features to draw arcs for</text>
  }
}
