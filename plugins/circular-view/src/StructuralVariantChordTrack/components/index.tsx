import PluginManager from '@gmod/jbrowse-core/PluginManager'
import LoadingF from '../../ChordTrack/components/Loading'
import TrackErrorF from '../../ChordTrack/components/TrackError'
import RpcRenderedSvgGroupF from './RpcRenderedSvgGroup'

export default ({ lib, load }: PluginManager) => {
  const React = lib.react
  const { observer, PropTypes: MobxPropTypes } = lib['mobx-react']

  const Loading = load(LoadingF)
  const TrackError = load(TrackErrorF)
  const RpcRenderedSvgGroup = load(RpcRenderedSvgGroupF)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function StructuralVariantChordTrack({ track }: any) {
    if (track.error) return <TrackError model={track} />
    if (!track.filled) return <Loading model={track} />
    return <RpcRenderedSvgGroup model={track} />
  }
  StructuralVariantChordTrack.propTypes = {
    track: MobxPropTypes.observableObject.isRequired,
  }
  return observer(StructuralVariantChordTrack)
}
