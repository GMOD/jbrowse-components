import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getSession, getContainingView } from '@jbrowse/core/util'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderReactionData(self: any) {
  const view = getContainingView(self)
  const { rendererType } = self
  const { rpcManager } = getSession(view)

  return {
    rendererType,
    rpcManager,
    renderProps: self.renderProps(),
    renderArgs: {
      assemblyName: view.displayedRegions[0]?.assemblyName,
      adapterConfig: JSON.parse(JSON.stringify(self.adapterConfig)),
      rendererType: rendererType.name,
      regions: JSON.parse(JSON.stringify(view.displayedRegions)),
      blockDefinitions: self.blockDefinitions,
      sessionId: getRpcSessionId(self),
      timeout: 1000000,
    },
  }
}

export async function renderReactionEffect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any,
  signal: AbortSignal,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  self: any,
) {
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
