import { readConfObject } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { DotplotViewModel } from '../DotplotView/model'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export function renderBlockData(self: IAnyStateTreeNode) {
  const { rpcManager } = getSession(self)
  const { rendererType } = self
  const { adapterConfig } = self
  const parent = getContainingView(self) as DotplotViewModel

  // Alternative to readConfObject(config) is below used because renderProps is
  // something under our control.  Compare to serverSideRenderedBlock
  readConfObject(self.configuration)
  getSnapshot(parent)

  // Access alpha, minAlignmentLength, and colorBy to make reaction reactive to changes
  if (parent.initialized) {
    const { viewWidth, viewHeight, borderSize, borderX, borderY } = parent
    return {
      rendererType,
      rpcManager,
      renderProps: {
        ...self.renderProps(),
        view: structuredClone(getSnapshot(parent)),
        width: viewWidth,
        height: viewHeight,
        borderSize,
        borderX,
        borderY,
        adapterConfig,
        rendererType: rendererType.name,
        sessionId: getRpcSessionId(self),
        trackInstanceId: getContainingTrack(self).id,
        timeout: 1000000, // 10000,
        alpha: self.alpha,
        minAlignmentLength: self.minAlignmentLength,
        colorBy: self.colorBy,
      },
      renderingProps: self.renderingProps?.() as
        | Record<string, unknown>
        | undefined,
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

  const { rendererType, rpcManager, renderProps, renderingProps } = props
  const { reactElement, ...data } = await rendererType.renderInClient(
    rpcManager,
    { ...renderProps, renderingProps },
  )
  return {
    reactElement,
    data,
    renderingComponent: rendererType.ReactComponent,
  }
}
