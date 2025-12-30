import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { types } from '@jbrowse/mobx-state-tree'

import type { StopToken } from '@jbrowse/core/util/stopToken'

/**
 * #stateModel NonBlockCanvasDisplayMixin
 * #category display
 *
 * Mixin for non-block-based displays that render to a single canvas.
 * Provides common state for tracking rendering offset, loading state,
 * and canvas references.
 *
 * Used by displays like LinearReadCloudDisplay, LinearReadArcsDisplay,
 * and LinearHicDisplay that render across the entire view width rather
 * than in discrete blocks.
 */
export default function NonBlockCanvasDisplayMixin() {
  return types
    .model('NonBlockCanvasDisplayMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * Loading state for data fetching/rendering
       */
      loading: false,
      /**
       * #volatile
       * The offsetPx of the view when the canvas was last rendered.
       * Used to calculate how much to shift the canvas during scrolling
       * before a new render completes.
       */
      lastDrawnOffsetPx: undefined as number | undefined,
      /**
       * #volatile
       * Reference to the main canvas element
       */
      ref: null as HTMLCanvasElement | null,
      /**
       * #volatile
       * ImageBitmap returned from RPC rendering
       */
      renderingImageData: undefined as ImageBitmap | undefined,
      /**
       * #volatile
       * Stop token for the current rendering operation
       */
      renderingStopToken: undefined as StopToken | undefined,
      /**
       * #volatile
       * Status message to display during loading
       */
      statusMessage: undefined as string | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * Whether the display has been rendered at least once
       */
      get drawn() {
        return self.lastDrawnOffsetPx !== undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Set the offsetPx at which the canvas was rendered
       */
      setLastDrawnOffsetPx(n: number) {
        self.lastDrawnOffsetPx = n
      },
      /**
       * #action
       * Set loading state
       */
      setLoading(f: boolean) {
        self.loading = f
      },
      /**
       * #action
       * Set reference to the canvas element
       */
      setRef(ref: HTMLCanvasElement | null) {
        self.ref = ref
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
      /**
       * #action
       * Set the status message displayed during loading
       */
      setStatusMessage(msg?: string) {
        self.statusMessage = msg
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

export type NonBlockCanvasDisplayMixinType = ReturnType<
  typeof NonBlockCanvasDisplayMixin
>
