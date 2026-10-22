export const WINDOW_SIZE_DEFAULT = 100

/**
 * The window and step the adapter scores with: whole bases, at least 1, an
 * unset step tiling the windows, and a step never wider than its window, which
 * would leave gaps no score covers.
 */
export function resolveGCWindow(windowSize: number, windowDelta?: number) {
  const size = Math.max(1, Math.round(windowSize))
  return {
    windowSize: size,
    windowDelta:
      windowDelta === undefined
        ? size
        : Math.min(size, Math.max(1, Math.round(windowDelta))),
  }
}
