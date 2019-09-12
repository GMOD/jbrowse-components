export default ({ jbrequire }) => {
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { getContainingView, getTrackAssemblyName } = jbrequire(
    '@gmod/jbrowse-core/util/tracks',
  )
  const { getSession } = jbrequire('@gmod/jbrowse-core/util')

  function renderReactionData(self) {
    const track = self
    const view = getContainingView(track)
    const { rendererType, renderProps } = track
    const { rpcManager } = getSession(view)

    const assemblyName = getTrackAssemblyName(track)
    const data = {
      rendererType,
      rpcManager,
      renderProps,
      renderArgs: {
        assemblyName,
        adapterType: track.adapterType.name,
        adapterConfig: getConf(track, 'adapter'),
        rendererType: rendererType.name,
        renderProps,
        regions: view.displayedRegions,
        blockDefinitions: view.blockDefinitions,
        sessionId: track.id,
        timeout: 1000000, // 10000,
      },
    }
    return data
  }

  async function renderReactionEffect(
    props,
    signal,
    self,
    mobxReactionHandle,
    allowRefetch = true,
  ) {
    if (!props) {
      throw new Error('cannot render with no props')
    }

    const {
      rendererType,
      // renderProps,
      rpcManager,
      cannotBeRenderedReason,
      renderArgs,
    } = props

    if (cannotBeRenderedReason) {
      return { message: cannotBeRenderedReason }
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
