export default ({ jbrequire }) => {
  const { isAlive, getParent, getRoot } = jbrequire('mobx-state-tree')
  const { assembleLocString, checkAbortSignal, isAbortException } = jbrequire(
    '@gmod/jbrowse-core/util',
  )
  const { readConfObject, getConf } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )
  const { getContainingView, getContainingDataset } = jbrequire(
    '@gmod/jbrowse-core/util/tracks',
  )

  function renderReactionData(self) {
    const track = self
    const view = getContainingView(track)
    const { rendererType, renderProps } = track
    const { rpcManager } = getRoot(view)

    // const trackConf = track.configuration
    // let trackConfParent = getParent(trackConf)
    // if (!trackConfParent.assemblyName)
    //   trackConfParent = getParent(trackConfParent)

    //   const trackAssemblyName = readConfObject(trackConfParent, 'assemblyName')
    // const trackAssemblyData =
    //   assemblyManager.assemblyData.get(trackAssemblyName) || {}

    // const trackAssemblyAliases = trackAssemblyData.aliases || []
    // let cannotBeRenderedReason
    // if (
    //   !(
    //     trackAssemblyName === self.region.assemblyName ||
    //     trackAssemblyAliases.includes(self.region.assemblyName)
    //   )
    // )
    //   cannotBeRenderedReason = 'region assembly does not match track assembly'
    // else cannotBeRenderedReason = track.regionCannotBeRendered(self.region)

    const assemblyName = readConfObject(
      getContainingDataset(track.configuration).assembly,
      'name',
    )
    const data = {
      rendererType,
      rpcManager,
      renderProps,
      // cannotBeRenderedReason,
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

  async function renderReactionEffect(self, props, allowRefetch = true) {
    if (!props) {
      return
    }

    const {
      rendererType,
      renderProps,
      rpcManager,
      cannotBeRenderedReason,
      renderArgs,
    } = props
    // console.log(getContainingView(self).rendererType)
    if (!isAlive(self)) return

    if (cannotBeRenderedReason) {
      self.setMessage(cannotBeRenderedReason)
      return
    }

    const aborter = new AbortController()
    self.setLoading(aborter)
    if (renderProps.notReady) return

    try {
      renderArgs.signal = aborter.signal
      // const callId = [
      //   assembleLocString(renderArgs.region),
      //   renderArgs.rendererType,
      // ]

      // check renderertype compatibility
      if (!self.isCompatibleWithRenderer(rendererType))
        throw new Error(
          `renderer ${
            rendererType.name
          } is not compatible with this track type`,
        )

      const { html, ...data } = await rendererType.renderInClient(
        rpcManager,
        renderArgs,
      )
      // if (aborter.signal.aborted) {
      //   console.log(...callId, 'request to abort render was ignored', html, data)
      // }
      checkAbortSignal(aborter.signal)
      self.setRendered(data, html, rendererType.ReactComponent)
    } catch (error) {
      if (!isAbortException(error)) console.error(error)
      if (isAbortException(error) && !aborter.signal.aborted) {
        // there is a bug in the underlying code and something is caching aborts. try to refetch once
        const track = getParent(self, 2)
        if (allowRefetch) {
          console.warn(`cached abort detected, refetching "${track.name}"`)
          renderReactionEffect(self, props, false)
          return
        }
        console.warn(`cached abort detected, failed to recover "${track.name}"`)
      }
      if (isAlive(self) && !isAbortException(error)) {
        self.setError(error)
      }
    }
  }

  return { renderReactionData, renderReactionEffect }
}
