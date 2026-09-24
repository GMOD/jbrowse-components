/**
 * Start loading a component made by `lazyWithPreload`; any other component is
 * left alone. React-free, so an eagerly evaluated module can call it.
 */
export function preloadComponent(component: unknown) {
  const { preload } = (component ?? {}) as { preload?: unknown }
  if (typeof preload === 'function') {
    ;(preload as () => Promise<unknown>)().catch(() => {})
  }
}
