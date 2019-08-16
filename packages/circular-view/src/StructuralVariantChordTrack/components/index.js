export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { observer, PropTypes: MobxPropTypes } = jbrequire('mobx-react')

  const Loading = jbrequire(require('../../ChordTrack/components/Loading'))
  const TrackError = jbrequire(
    require('../../ChordTrack/components/TrackError'),
  )
  const RpcRenderedSvgGroup = jbrequire(require('./RpcRenderedSvgGroup'))

  function StructuralVariantChordTrack({ track }) {
    if (track.error) return <TrackError model={track} />
    if (!track.filled) return <Loading model={track} />
    return <RpcRenderedSvgGroup model={track} />
  }
  StructuralVariantChordTrack.propTypes = {
    track: MobxPropTypes.observableObject.isRequired,
  }
  return observer(StructuralVariantChordTrack)
}
