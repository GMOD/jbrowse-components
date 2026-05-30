import { useRenderingBackend } from '@jbrowse/core/util'

import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'

import type { RenderLifecycleModel } from '@jbrowse/core/util/useRenderingBackend'

// Wraps useRenderingBackend and pre-builds the render-error overlay. Hand
// `renderError` to DisplayChrome, which shows it instead of the canvas when the
// GPU backend failed — so the render-error path can't be silently dropped (the
// bug that hit maf and alignments) while leaving each display free to lay out
// however many canvases it wants. `canvas`/`canvasRef` are the backend's;
// `renderError` is null on success.
export function useDisplayRendering<B extends { dispose(): void }>(
  factory: (canvas: HTMLCanvasElement) => Promise<B>,
  model: RenderLifecycleModel<B>,
  dims: { width?: number; height: number },
) {
  const { canvas, canvasRef, error, retry } = useRenderingBackend(factory, model)
  const renderError = error ? (
    <DisplayRenderErrorOverlay
      error={error}
      onRetry={retry}
      width={dims.width}
      height={dims.height}
    />
  ) : null
  return { canvas, canvasRef, renderError }
}
