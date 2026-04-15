/**
 * Handle returned by every GPU backend autorun-lifecycle utility. The shape
 * is deliberately identical across the multi-region and single-data families
 * so `GpuBackendLifecycleSlotMixin` can store either in a single slot.
 */
export interface GpuBackendLifecycleHandle {
  dispose: () => void
  /**
   * Imperatively re-issue the last render using the currently cached
   * state. Intended for non-MobX triggers (tab visibility, DOM scroll,
   * context restored).
   */
  renderNow: () => void
}
