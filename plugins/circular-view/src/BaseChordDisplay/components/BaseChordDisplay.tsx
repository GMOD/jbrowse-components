import PluginManager from '@jbrowse/core/PluginManager'
import ChordDisplayLoadingFactory from './Loading'
import ChordDisplayErrorFactory from './DisplayError'
import RpcRenderedSvgGroupF from './RpcRenderedSvgGroup'

export default ({ lib, load }: PluginManager) => {
  const React = lib.react
  const { observer, PropTypes: MobxPropTypes } = lib['mobx-react']

  const Loading = load(ChordDisplayLoadingFactory)
  const DisplayError = load(ChordDisplayErrorFactory)
  const RpcRenderedSvgGroup = load(RpcRenderedSvgGroupF)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function BaseChordDisplay({ display }: any) {
    if (display.error) {
      return <DisplayError model={display} />
    }
    if (!display.filled) {
      return <Loading model={display} />
    }
    return <RpcRenderedSvgGroup model={display} />
  }
  BaseChordDisplay.propTypes = {
    display: MobxPropTypes.observableObject.isRequired,
  }
  return observer(BaseChordDisplay)
}
