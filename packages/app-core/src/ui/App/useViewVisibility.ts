import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// No IntersectionObserver (jsdom/SSR): start (and stay) visible, the
// pre-lazy-mount behavior, so tests and non-browser environments are unchanged.
function intersectionObserverAvailable() {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window
}

/**
 * Whether the body is on screen as the observer's first callback would report
 * it: inside the viewport and inside every ancestor that clips, edges
 * included.
 */
function onScreen(node: Element) {
  const clip = {
    top: 0,
    left: 0,
    bottom: window.innerHeight,
    right: window.innerWidth,
  }
  for (let el = node.parentElement; el; el = el.parentElement) {
    const { overflowX, overflowY } = getComputedStyle(el)
    if (/auto|scroll|hidden|clip/.test(`${overflowX} ${overflowY}`)) {
      const r = el.getBoundingClientRect()
      clip.top = Math.max(clip.top, r.top)
      clip.left = Math.max(clip.left, r.left)
      clip.bottom = Math.min(clip.bottom, r.bottom)
      clip.right = Math.min(clip.right, r.right)
    }
  }
  const r = node.getBoundingClientRect()
  return (
    r.top <= clip.bottom &&
    r.bottom >= clip.top &&
    r.left <= clip.right &&
    r.right >= clip.left
  )
}

interface Visibility {
  visible: boolean
  // the body's own height, captured as it goes off-screen. Only read while
  // hidden, to hold the scroll position the unmounted body used to occupy
  height?: number
}

/**
 * View-level lazy mounting. A view only mounts its (GPU-heavy) body while it is
 * on screen, and collapses to a height-preserving spacer once scrolled away. This bounds the number of simultaneously-live
 * GPU canvases/contexts — the root cause of the "workspaces freeze" with many
 * stacked views (one WebGL context per display canvas blows past the browser's
 * per-page cap; see agent-docs/reference/ARCHITECTURAL_LIMITS.md, "One WebGL2
 * context per display canvas").
 *
 * `root: null` (viewport) is container-agnostic: it reports on-screen-ness the
 * same way whether the views scroll inside the classic container or a workspace
 * panel, so neither container needs to know about windowing. It also means
 * **a `rootMargin` would have no effect** wherever a container scrolls — an
 * observer clips the target against each scrolling ancestor before
 * intersecting with the root box that the margin expands, and both containers
 * are `overflow-y: auto`. Only an embed whose page scrolls instead would feel
 * one, and it gets the same window. So this is a hard window with no
 * hysteresis: a view is torn down the moment it leaves its
 * container and rebuilt when it returns, which on a GPU backend costs a fresh
 * WebGL2 context and a full shader recompile per display.
 *
 * That is deliberate as of 2026-08-05, not an oversight. Rooting the observer at
 * the scroll port restores the band and measures as a wash on scroll cost while
 * roughly doubling live contexts — and the ceiling is 16 live contexts, so the
 * cap bites before the rebuild saving pays for itself.
 * agent-docs/reference/GPU_PORTABILITY.md has the numbers and the three
 * other fixes that were measured and eliminated.
 *
 * Starts hidden so a cold load with N crammed views doesn't mount them all at
 * once. The first layout mounts what is on screen before anything paints, and
 * the observer tracks it from there: waiting for the observer's first callback
 * instead left every view an empty box for a frame or more, ~100 ms on a cold
 * load with the main thread busy.
 */
export function useViewVisibility() {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<Visibility>(() => ({
    visible: !intersectionObserverAvailable(),
  }))

  useLayoutEffect(() => {
    const node = ref.current
    if (node && intersectionObserverAvailable() && onScreen(node)) {
      setState(prev => (prev.visible ? prev : { ...prev, visible: true }))
    }
  }, [])

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
      const io = new IntersectionObserver(entries => {
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
      })
      io.observe(node)
      return () => {
        io.disconnect()
      }
    }
    return undefined
  }, [])

  // `measuredHeight` is undefined until the body has been seen at least once.
  // The caller supplies the estimate, and supplies it lazily. See ViewContainer
  return {
    ref,
    visible: state.visible,
    measuredHeight: state.height,
  }
}
