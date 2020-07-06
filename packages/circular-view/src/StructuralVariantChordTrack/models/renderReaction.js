export default ({ jbrequire }) => {
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { getRpcSessionId } = jbrequire('@gmod/jbrowse-core/util/tracks')
  const { getContainingView } = jbrequire('@gmod/jbrowse-core/util')
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')

  function renderReactionData(self) {
    const track = self
    const view = getContainingView(track)
    const { rendererType, renderProps } = track
    const { rpcManager } = getSession(view)

    return {
      rendererType,
      rpcManager,
      renderProps,
      renderArgs: {
        adapterConfig: JSON.parse(JSON.stringify(getConf(track, 'adapter'))),
        rendererType: rendererType.name,
        renderProps,
        regions: JSON.parse(JSON.stringify(view.displayedRegions)),
        blockDefinitions: view.blockDefinitions,
        sessionId: getRpcSessionId(track),
        timeout: 1000000, // 10000,
      },
    }
  }

  async function renderReactionEffect(props, signal, self) {
    if (!props) {
      throw new Error('cannot render with no props')
    }

    const {
      rendererType,
      rpcManager,
      cannotBeRenderedReason,
      renderArgs,
    } = props

    if (cannotBeRenderedReason) {
      return { message: cannotBeRenderedReason }
    }

    // don't try to render 0 or NaN radius or no regions
    if (
      !props.renderProps.radius ||
      !props.renderArgs.regions ||
      !props.renderArgs.regions.length
    ) {
      return { message: 'Skipping render' }
    }

    // check renderertype compatibility
    if (!self.isCompatibleWithRenderer(rendererType))
      throw new Error(
        `renderer ${rendererType.name} is not compatible with this track type`,
      )

    const { html, ...data } = await rendererType.renderInClient(rpcManager, {
      ...renderArgs,
      signal,
    })

    return { html, data, renderingComponent: rendererType.ReactComponent }
  }

  return { renderReactionData, renderReactionEffect }
}
