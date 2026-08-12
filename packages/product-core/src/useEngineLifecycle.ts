import { useEffect, useRef } from 'react'

import { destroyViewState } from './destroyViewState.ts'

import type { EmbeddedRoot } from './destroyViewState.ts'

/**
 * Build a value exactly once per mount — including under React StrictMode,
 * which `useState(() => build())` does not.
 *
 * StrictMode double-invokes a state initializer in development and throws the
 * SECOND result away. For an ordinary value that is the intended lint: it
 * surfaces impure initializers and costs nothing. For an engine it stands up a
 * whole second RPC worker pool and autorun set and then drops the only
 * reference to it, so nothing can ever destroy it — the exact leak
 * {@link destroyViewState} exists to prevent, arriving on every mount of every
 * StrictMode host, and invisible because the engine React kept behaves
 * perfectly. A ref is written once and survives the double render; this is
 * React's own "avoiding recreating the ref contents" pattern.
 */
export function useCreateOnce<T>(create: () => T): T {
  // boxed, so a `create` that legitimately returns undefined isn't re-run every
  // render by the nullish assignment
  const ref = useRef<{ value: T } | undefined>(undefined)
  ref.current ??= { value: create() }
  return ref.current.value
}

/**
 * Destroy an engine when its component really unmounts.
 *
 * "Really" is the whole difficulty, because React does not distinguish a final
 * unmount from a simulated one. The obvious spelling —
 * `useEffect(() => () => destroyViewState(state), [state])` — is wrong in
 * exactly the environment most SPA hosts develop in: StrictMode runs
 * setup → cleanup → setup on a live component, the cleanup destroys the tree,
 * the second setup has nothing to rebuild from, and the component goes on
 * rendering a dead engine. That is not a quiet degradation; the view throws
 * `[mobx-state-tree] Failed to find the parent of …[dead]` on the next commit.
 *
 * So the teardown is deferred by a microtask and cancelled if setup runs again.
 * StrictMode's cleanup and re-setup are one synchronous block, so the cancel
 * always wins there; a real unmount never runs setup again, so the microtask
 * fires and the worker pool and the autoruns go away.
 *
 * Deliberately not covered: a subtree hidden with `<Activity>`, which destroys
 * effects and re-creates them a task later rather than synchronously. The
 * engine is torn down when the subtree is hidden and is not rebuilt when it is
 * shown. A host that needs a view to survive being hidden should own the engine
 * itself with `createViewState` and keep it outside the hidden tree.
 */
export function useDestroyOnUnmount(viewState: EmbeddedRoot) {
  const teardownPending = useRef(false)
  useEffect(() => {
    // this setup owns `viewState`: cancel a teardown a preceding cleanup queued
    teardownPending.current = false
    return () => {
      teardownPending.current = true
      queueMicrotask(() => {
        if (teardownPending.current) {
          destroyViewState(viewState)
        }
      })
    }
  }, [viewState])
}
