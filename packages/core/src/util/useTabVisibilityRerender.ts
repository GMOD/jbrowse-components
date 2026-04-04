import { useEffect, useEffectEvent } from 'react'

/**
 * Re-renders GPU canvases when the browser tab becomes visible again.
 *
 * WebGPU (and some WebGL configurations) discard the swap-chain texture when
 * a tab is hidden. MobX autoruns only re-fire when observables change, so
 * returning to the tab shows a black canvas. This hook triggers one extra
 * render on `visibilitychange` to restore the content.
 *
 * Pass whatever function your component uses to issue GPU draw calls. It is
 * captured via `useEffectEvent` so it always sees the latest closure values
 * without needing to be listed as a dependency.
 */
export function useTabVisibilityRerender(renderFn: () => void) {
  const stableRender = useEffectEvent(renderFn)

  useEffect(() => {
    const handle = () => {
      if (!document.hidden) {
        stableRender()
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => {
      document.removeEventListener('visibilitychange', handle)
    }
  }, [])
}
