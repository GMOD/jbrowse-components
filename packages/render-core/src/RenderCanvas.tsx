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
 * 2D context not available" — and more generally a canvas's context kind is
 * permanent, so a re-init whose HAL ladder lands on a different rung than last
 * time cannot bind at all. These consumers keep their canvas mounted through an
 * error by design (ADR-025), so they must key it; `DisplayChromeBase` keys its
 * render-prop body on the same value for the displays on the chrome, which it
 * does *not* get for free from the `renderError` unmount (that covers only a
 * reported loss — see the `canvasKey` note in useRenderingBackend.ts).
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
 * frozen contract across four test systems (DISPLAYCHROME.md, "One element per
 * display"), only one of which runs outside CI. Centralizing the
 * convention here silently rewrote the separator; the jest suites caught it,
 * which is luckier than this class of change usually gets. Their readiness flag
 * is `settled`, not `canvasDrawn`, for a real reason too — a shared canvas
 * repaints unconditionally, so `canvasDrawn` says nothing (ADR-009's scope
 * clause) — so the ternary stays at the call site where both facts are visible.
 */
export default function RenderCanvas({
  handle,
  drawn,
  ...canvasProps
}: {
  handle: RenderCanvasHandle
  /**
   * Whether this canvas holds finished content — each view's own `settled`, the
   * same flag its `*_canvas_done` testid is built from. Published as
   * `data-display-drawn`, which is what `PENDING_DISPLAYS`
   * (`@jbrowse/browser-test-utils`) selects on, so these views answer "has
   * everything painted?" with the same attribute every LGV display does.
   *
   * Required, and that is the point: `PENDING_DISPLAYS` used to name
   * `synteny_canvas` explicitly and simply **forgot dotplot**, so an unpainted
   * dotplot counted as finished and a capture could land on it blank. A new
   * drop-to-primitive view would have been forgotten the same way.
   */
  drawn: boolean
} & Omit<ComponentPropsWithoutRef<'canvas'>, 'ref'>) {
  return (
    <canvas
      data-display-drawn={drawn}
      // A changed key remounts the element, which is the whole point — see the
      // context-loss note above. React compares keys for a single child too, so
      // this does not need to sit in an array to take effect.
      key={handle.canvasKey}
      ref={handle.canvasRef}
      {...canvasProps}
    />
  )
}
