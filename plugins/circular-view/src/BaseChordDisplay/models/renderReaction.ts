import { getSession, getContainingView } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import clone from 'clone'

// locals
import type { CircularViewModel } from '../../CircularView/models/model'

export function renderReactionData(self: any) {
  const view = getContainingView(self) as CircularViewModel
  const { rendererType } = self
  const { rpcManager } = getSession(view)

  return {
    rendererType,
    rpcManager,
    renderProps: self.renderProps(),
    renderArgs: {
      assemblyName: view.displayedRegions[0]!.assemblyName,
      adapterConfig: clone(self.adapterConfig),
      rendererType: rendererType.name,
      regions: clone(view.displayedRegions),
      blockDefinitions: self.blockDefinitions,
      sessionId: getRpcSessionId(self),
      timeout: 1000000,
    },
  }
}

export async function renderReactionEffect(props?: any, stopToken?: string) {
  if (!props) {
    throw new Error('cannot render with no props')
  }

  const {
    rendererType,
    rpcManager,
    cannotBeRenderedReason,
    renderArgs,
    renderProps,
    exportSVG,
  } = props

  if (cannotBeRenderedReason) {
    return { message: cannotBeRenderedReason }
  }

  // don't try to render 0 or NaN radius or no regions
  if (!renderProps.radius || !renderArgs.regions?.length) {
    return { message: 'Skipping render' }
  }

  const { html, ...data } = await rendererType.renderInClient(rpcManager, {
    ...renderArgs,
    ...renderProps,
    exportSVG,
    stopToken,
  })

  return {
    html,
    data,
    reactElement: data.reactElement,
    renderingComponent: rendererType.ReactComponent,
  }
}
