export default ({ jbrequire }) => {
  const { isAlive, getParent, getRoot } = jbrequire('mobx-state-tree')
  const { assembleLocString, checkAbortSignal, isAbortException } = jbrequire(
    '@gmod/jbrowse-core/util',
  )
  const { readConfObject, getConf } = jbrequire(
    '@gmod/jbrowse-core/configuration',
  )
  const { getContainingView, getContainingAssembly } = jbrequire(
    '@gmod/jbrowse-core/util/tracks',
  )

  function renderReactionData(self) {
    const track = self
    const view = getContainingView(track)
    const { rpcManager, assemblyManager } = getRoot(view)

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

    const renderProps = { ...track.renderProps }
    const { rendererType } = track
    const assemblyName = readConfObject(
      getContainingAssembly(track.configuration),
      'assemblyName',
    )
    return {
      rendererType,
      rpcManager,
      renderProps,
      // cannotBeRenderedReason,
      trackError: track.error,
      renderArgs: {
        assemblyName,
        region: self.region,
        adapterType: track.adapterType.name,
        adapterConfig: getConf(track, 'adapter'),
        rendererType: rendererType.name,
        renderProps,
        sessionId: track.id,
        timeout: 1000000, // 10000,
      },
    }
  }

  async function renderReactionEffect(self, props, allowRefetch = true) {
    const {
      trackError,
      rendererType,
      renderProps,
      rpcManager,
      cannotBeRenderedReason,
      renderArgs,
    } = props
    // console.log(getContainingView(self).rendererType)
    if (!isAlive(self)) return

    if (trackError) {
      self.setError(trackError)
      return
    }
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
      const { html, ...data } = await rendererType.renderInClient(
        rpcManager,
        renderArgs,
      )
      // if (aborter.signal.aborted) {
      //   console.log(...callId, 'request to abort render was ignored', html, data)
      // }
      checkAbortSignal(aborter.signal)
      self.setRendered(data, html, rendererType.ReactComponent, renderProps)
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
        // setting the aborted exception as an error will draw the "aborted" error, and we
        // have not found how to create a re-render if this occurs
        self.setError(error)
      }
    }
  }

  return { renderReactionData, renderReactionEffect }
}
