import { useEffect, useRef, useState } from 'react'

// No IntersectionObserver (jsdom/SSR): start (and stay) visible, the
// pre-lazy-mount behavior, so tests and non-browser environments are unchanged.
function intersectionObserverAvailable() {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window
}

/**
 * View-level lazy mounting. A view only mounts its (GPU-heavy) body when it is
 * within `rootMargin` of the viewport, and collapses to a height-preserving
 * spacer once scrolled far away. This bounds the number of simultaneously-live
 * GPU canvases/contexts — the root cause of the "workspaces freeze" with many
 * stacked views (one WebGL context per display canvas blows past the browser's
 * per-page cap; see agent-docs/workspaces-freeze-investigation.md).
 *
 * `root: null` (viewport) is container-agnostic: it reports on-screen-ness the
 * same way whether the views scroll inside the classic container or a dockview
 * panel, so neither container needs to know about windowing.
 *
 * Starts hidden so a cold load with N crammed views doesn't mount them all at
 * once; the observer's first callback mounts only what's near the viewport.
 */
export function useViewVisibility(rootMargin: string, estimatedHeight: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(() => !intersectionObserverAvailable())
  const [rememberedHeight, setRememberedHeight] = useState(0)

  // Toggle `visible` as the body scrolls in/out of the viewport (root: null).
  useEffect(() => {
    const node = ref.current
    if (node && intersectionObserverAvailable()) {
      const io = new IntersectionObserver(
        entries => {
          const entry = entries[entries.length - 1]
          if (entry) {
            setVisible(entry.isIntersecting)
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

  // Only measure while visible, so we record the body's real content height and
  // never the collapsed spacer height. Re-subscribing on the `visible`
  // transition lets the callback record unconditionally, instead of reading the
  // latest `visible` back through a render-written ref.
  useEffect(() => {
    const node = ref.current
    if (node && visible && 'ResizeObserver' in window) {
      const ro = new ResizeObserver(entries => {
        const box = entries[entries.length - 1]?.contentBoxSize[0]
        if (box && box.blockSize > 0) {
          setRememberedHeight(box.blockSize)
        }
      })
      ro.observe(node)
      return () => {
        ro.disconnect()
      }
    }
    return undefined
  }, [visible])

  return {
    ref,
    visible,
    placeholderHeight: rememberedHeight || estimatedHeight,
  }
}
