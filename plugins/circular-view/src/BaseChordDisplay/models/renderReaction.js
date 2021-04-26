export default ({ jbrequire }) => {
  const { getRpcSessionId } = jbrequire('@jbrowse/core/util/tracks')
  const { getContainingView } = jbrequire('@jbrowse/core/util')
  const { getSession } = jbrequire('@jbrowse/core/util')

  function renderReactionData(self) {
    const display = self
    const view = getContainingView(display)
    const { rendererType, renderProps } = display
    const { rpcManager } = getSession(view)

    const a = {
      rendererType,
      rpcManager,
      renderProps,
      renderArgs: {
        // TODO: Figure this out for multiple assembly names
        assemblyName: view.displayedRegions[0]?.assemblyName,
        adapterConfig: JSON.parse(JSON.stringify(display.adapterConfig)),
        rendererType: rendererType.name,
        regions: JSON.parse(JSON.stringify(view.displayedRegions)),
        blockDefinitions: view.blockDefinitions,
        sessionId: getRpcSessionId(display),
        timeout: 1000000, // 10000,
      },
    }
    return a
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
      renderProps,
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
    if (!self.isCompatibleWithRenderer(rendererType)) {
      throw new Error(
        `renderer ${rendererType.name} is not compatible with this display type`,
      )
    }

    const { html, ...data } = await rendererType.renderInClient(rpcManager, {
      ...renderArgs,
      ...renderProps,
      signal,
    })

    return { html, data, renderingComponent: rendererType.ReactComponent }
  }

  return { renderReactionData, renderReactionEffect }
}
