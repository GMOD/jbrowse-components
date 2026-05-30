import type { ReactNode } from 'react'

import { useRenderingBackend } from '@jbrowse/core/util'

import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'

import type { RenderLifecycleModel } from '@jbrowse/core/util/useRenderingBackend'

type Rendered = Omit<ReturnType<typeof useRenderingBackend>, 'error' | 'retry'>

export type DisplayRendering =
  | { kind: 'error'; node: ReactNode }
  | ({ kind: 'ready' } & Rendered)

// Gates the canvas behind error handling: `canvasRef`/`canvas` exist only on the
// 'ready' variant, so a display can't reach its canvas without first handling
// 'error'. Makes "render the canvas, forget the render error" — the bug that
// slipped into maf and alignments — a compile error. The 'error' variant carries
// the ready-built overlay, so every display renders it identically with a single
// `if (rendering.kind === 'error') return rendering.node`.
export function useDisplayRendering<B extends { dispose(): void }>(
  factory: (canvas: HTMLCanvasElement) => Promise<B>,
  model: RenderLifecycleModel<B>,
  dims: { width?: number; height: number },
): DisplayRendering {
  const { canvas, canvasRef, error, retry } = useRenderingBackend(factory, model)
  return error
    ? {
        kind: 'error',
        node: (
          <DisplayRenderErrorOverlay
            error={error}
            onRetry={retry}
            width={dims.width}
            height={dims.height}
          />
        ),
      }
    : { kind: 'ready', canvas, canvasRef }
}
