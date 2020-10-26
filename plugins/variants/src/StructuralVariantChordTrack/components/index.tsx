import PluginManager from '@jbrowse/core/PluginManager'
import {
  ChordTrackLoadingFactory,
  ChordTrackErrorFactory,
} from '@jbrowse/plugin-circular-view'
import RpcRenderedSvgGroupF from './RpcRenderedSvgGroup'

export default ({ lib, load }: PluginManager) => {
  const React = lib.react
  const { observer, PropTypes: MobxPropTypes } = lib['mobx-react']

  const Loading = load(ChordTrackLoadingFactory)
  const TrackError = load(ChordTrackErrorFactory)
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
