// Re-export shim: this hook moved to @jbrowse/render-core. Use named
// re-exports (not `export *`) so bundlers can trace the names through the
// util barrel's named re-export of `useRenderingBackend`.
export {
  type RenderLifecycleModel,
  useRenderingBackend,
} from '@jbrowse/render-core'
