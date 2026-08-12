import { useEffect, useRef, useState } from 'react'

// No IntersectionObserver (jsdom/SSR): start (and stay) visible, the
// pre-lazy-mount behavior, so tests and non-browser environments are unchanged.
function intersectionObserverAvailable() {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window
}

interface Visibility {
  visible: boolean
  // the body's own height, captured as it goes off-screen. Only read while
  // hidden, to hold the scroll position the unmounted body used to occupy
  height?: number
}

/**
 * View-level lazy mounting. A view only mounts its (GPU-heavy) body when it is
 * within `rootMargin` of the viewport, and collapses to a height-preserving
 * spacer once scrolled far away. This bounds the number of simultaneously-live
 * GPU canvases/contexts — the root cause of the "workspaces freeze" with many
 * stacked views (one WebGL context per display canvas blows past the browser's
 * per-page cap; see agent-docs/reference/ARCHITECTURAL_LIMITS.md, "One WebGL2
 * context per display canvas").
 *
 * `root: null` (viewport) is container-agnostic: it reports on-screen-ness the
 * same way whether the views scroll inside the classic container or a workspace
 * panel, so neither container needs to know about windowing. It also means
 * **`rootMargin` has no effect** — an observer clips the target against each
 * scrolling ancestor before intersecting with the root box that the margin
 * expands, and both containers are `overflow-y: auto`. So this is a hard
 * window with no hysteresis: a view is torn down the moment it leaves its
 * container and rebuilt when it returns, which on a GPU backend costs a fresh
 * WebGL2 context and a full shader recompile per display.
 *
 * That is deliberate as of 2026-08-05, not an oversight. Rooting the observer at
 * the scroll port restores the band and measures as a wash on scroll cost while
 * roughly doubling live contexts — and the ceiling is 16 live contexts, so the
 * cap bites before the rebuild saving pays for itself.
 * agent-docs/reference/GPU_CONTEXT_BUDGET.md has the numbers and the three
 * other fixes that were measured and eliminated.
 *
 * Starts hidden so a cold load with N crammed views doesn't mount them all at
 * once; the observer's first callback mounts only what's near the viewport.
 */
export function useViewVisibility(rootMargin: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<Visibility>(() => ({
    visible: !intersectionObserverAvailable(),
  }))

  // Toggle `visible` as the body scrolls in/out of the viewport (root: null),
  // and record the height it had on the way out.
  //
  // The height comes off the entry the observer already handed us. At the
  // moment the body stops intersecting it is still mounted at full height (the
  // collapse is what this callback is about to cause), so the entry's rect is
  // exactly what a ResizeObserver would have reported. Keeping one
  // meant a second observer per view whose every fire re-rendered the whole
  // view chrome, and a view's height moves constantly: every track added,
  // resized, or grown by its own data.
  useEffect(() => {
    const node = ref.current
    if (node && intersectionObserverAvailable()) {
      const io = new IntersectionObserver(
        entries => {
          const entry = entries.at(-1)
          if (entry) {
            const { isIntersecting } = entry
            setState(prev => {
              if (prev.visible === isIntersecting) {
                return prev
              }
              return {
                visible: isIntersecting,
                // a minimized view measures 0 here (it renders no body at
                // all), which must not become its remembered height
                height: isIntersecting
                  ? prev.height
                  : entry.boundingClientRect.height || prev.height,
              }
            })
          }
        },
        { rootMargin },
      )
      io.observe(node)
      return () => {
        io.disconnect()
      }
    }
    return undefined
  }, [rootMargin])

  // `measuredHeight` is undefined until the body has been seen at least once.
  // The caller supplies the estimate, and supplies it lazily. See ViewContainer
  return {
    ref,
    visible: state.visible,
    measuredHeight: state.height,
  }
}
