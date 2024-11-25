import { readConfObject } from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import clone from 'clone'
import { getSnapshot } from 'mobx-state-tree'

import type { DotplotViewModel } from '../DotplotView/model'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

export function renderBlockData(self: IAnyStateTreeNode) {
  const { rpcManager } = getSession(self)
  const { rendererType } = self
  const { adapterConfig } = self
  const parent = getContainingView(self) as DotplotViewModel

  // Alternative to readConfObject(config) is below used because renderProps is
  // something under our control.  Compare to serverSideRenderedBlock
  readConfObject(self.configuration)
  getSnapshot(parent)

  if (parent.initialized) {
    const { viewWidth, viewHeight, borderSize, borderX, borderY } = parent
    return {
      rendererType,
      rpcManager,
      renderProps: {
        ...self.renderProps(),
        view: clone(getSnapshot(parent)),
        width: viewWidth,
        height: viewHeight,
        borderSize,
        borderX,
        borderY,
        adapterConfig,
        rendererType: rendererType.name,
        sessionId: getRpcSessionId(self),
        timeout: 1000000, // 10000,
      },
    }
  }
  return undefined
}

export async function renderBlockEffect(
  props?: ReturnType<typeof renderBlockData>,
) {
  if (!props) {
    return
  }

  const { rendererType, rpcManager, renderProps } = props
  const { reactElement, ...data } = await rendererType.renderInClient(
    rpcManager,
    renderProps,
  )
  return {
    reactElement,
    data,
    renderingComponent: rendererType.ReactComponent,
  }
}
