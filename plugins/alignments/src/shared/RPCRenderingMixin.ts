import { getConf } from '@jbrowse/core/configuration'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { types } from '@jbrowse/mobx-state-tree'

import type { StopToken } from '@jbrowse/core/util/stopToken'

/**
 * Mixin for displays that use RPC-based rendering (non-block-based)
 * Provides common state, actions, and views for RPC rendering
 */
export function RPCRenderingMixin() {
  return types
    .model('RPCRenderingMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * ImageData returned from RPC rendering
       */
      renderingImageData: undefined as ImageBitmap | undefined,
      /**
       * #volatile
       * Stop token for the current rendering operation
       */
      renderingStopToken: undefined as StopToken | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get colorBy() {
        // @ts-expect-error colorBySetting comes from LinearReadDisplayBaseMixin
        return self.colorBySetting ?? getConf(self, 'colorBy')
      },
      /**
       * #getter
       */
      get filterBy() {
        // @ts-expect-error filterBySetting comes from LinearReadDisplayBaseMixin
        return self.filterBySetting ?? getConf(self, 'filterBy')
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      reload() {
        // @ts-expect-error error comes from BaseDisplay
        self.error = undefined
      },
      /**
       * #action
       * Set the rendering imageData from RPC
       */
      setRenderingImageData(imageData: ImageBitmap | undefined) {
        self.renderingImageData = imageData
      },
      /**
       * #action
       * Set the rendering stop token
       */
      setRenderingStopToken(token?: StopToken) {
        self.renderingStopToken = token
      },
    }))
    .actions(self => ({
      beforeDestroy() {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
        }
      },
    }))
}
