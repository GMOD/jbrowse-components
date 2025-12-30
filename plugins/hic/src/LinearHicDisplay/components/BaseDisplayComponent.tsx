/**
 * Re-export the shared NonBlockCanvasDisplayComponent from linear-genome-view.
 * This provides a consistent display container for non-block-based canvas displays
 * that handles:
 * - Error/loading states
 * - Offset positioning during scrolling (lastDrawnOffsetPx - view.offsetPx)
 * - Loading indicator
 * - Optional legend display
 */
export { NonBlockCanvasDisplayComponent as default } from '@jbrowse/plugin-linear-genome-view'
export type { NonBlockCanvasDisplayModel } from '@jbrowse/plugin-linear-genome-view'
