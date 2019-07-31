export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { observer } = jbrequire('mobx-react')

  const Loading = jbrequire(require('../../ChordTrack/components/Loading'))
  const RpcRenderedSvgGroup = jbrequire(require('./RpcRenderedSvgGroup'))

  function StructuralVariantChordTrack({ track, view }) {
    if (!track.filled) return <Loading model={track} />
    return <RpcRenderedSvgGroup model={track} />
  }
  return observer(StructuralVariantChordTrack)
}
