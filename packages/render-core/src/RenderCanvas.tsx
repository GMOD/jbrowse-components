import type { ComponentPropsWithoutRef } from 'react'

/**
 * The two fields of `useRenderingBackend`'s return value this needs, duck-typed
 * so the hook's generic backend parameter doesn't have to be threaded here.
 */
export interface RenderCanvasHandle {
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvasKey: number
}

/**
 * The `<canvas>` for a rendering backend owned **outside** `DisplayChrome` — the
 * sanctioned drop-to-primitive path for the non-LGV views (dotplot, the synteny
 * level), which have no `ChromeModel` contract and render their own banners.
 *
 * It exists for one invariant that was previously carried by prose:
 * **`key={canvasKey}`**. Every backend re-init needs a canvas element that never
 * held a context — `getContext('webgl2')` hands back the *same lost* context,
 * and `getContext('2d')` returns **null** on any element that once had WebGL, so
 * reusing the element turns a recoverable context loss into a permanent "Canvas
 * 2D context not available". `DisplayChrome` consumers get a fresh element for
 * free, since the `renderError` phase unmounts the canvas; these consumers keep
 * theirs mounted through an error by design (ADR-025), so they must key it.
 * GPU_RENDERING.md said so and ended with "any new consumer rendering its own
 * banner must too" — a rule enforced by remembering to read the doc. Rendering
 * the element here makes it structural instead: there is no way to mount this
 * canvas without the key.
 *
 * It owns the key and **nothing else** — everything (sizing, class, mouse
 * handlers, `data-testid`) is forwarded. In particular it does *not* fold in
 * `DisplayChrome`'s `-done` testid convention, which was the obvious extra to
 * hand it: these two views emit `synteny_canvas_done` /
 * `dotplot_webgl_canvas_done` with an **underscore**, and those selectors are a
 * frozen contract across four test systems (DISPLAYCHROME.md, "First-paint
 * `-done` testid"), only one of which runs outside CI. Centralizing the
 * convention here silently rewrote the separator; the jest suites caught it,
 * which is luckier than this class of change usually gets. Their readiness flag
 * is `settled`, not `canvasDrawn`, for a real reason too — a shared canvas
 * repaints unconditionally, so `canvasDrawn` says nothing (ADR-009's scope
 * clause) — so the ternary stays at the call site where both facts are visible.
 */
export default function RenderCanvas({
  handle,
  ...canvasProps
}: {
  handle: RenderCanvasHandle
} & Omit<ComponentPropsWithoutRef<'canvas'>, 'ref'>) {
  return (
    <canvas
      // A changed key remounts the element, which is the whole point — see the
      // context-loss note above. React compares keys for a single child too, so
      // this does not need to sit in an array to take effect.
      key={handle.canvasKey}
      ref={handle.canvasRef}
      {...canvasProps}
    />
  )
}
