import { useCallback, useLayoutEffect, useRef } from 'react'

// Observer-safe replacement for React's useEffectEvent. Returns a stable
// callback that always invokes the latest `fn`.
//
// React's useEffectEvent reads stale state inside mobx-react `observer()`
// components (its impl swap does not take effect under observer's reactive
// render), and nearly every JBrowse component is an observer. Here the ref is
// updated in a layout effect — which runs before paint and before any browser
// event can fire the stable callback, so it never reads a stale closure.
export function useEventCallback<Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
) {
  const ref = useRef(fn)
  useLayoutEffect(() => {
    ref.current = fn
  })
  return useCallback((...args: Args) => ref.current(...args), [])
}
