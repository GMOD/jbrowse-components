import { createMarkBackend } from '@jbrowse/render-core/marks/backend'

import { WIGGLE_MARKS } from './wiggleMarks.ts'

// Both wiggle-family components build their backend here rather than each
// declaring its own factory: the mark list is the same one, and a second
// factory would be a second place the display's passes are stated.
export function WiggleRenderer(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, WIGGLE_MARKS)
}
