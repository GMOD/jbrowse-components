import { createMarkBackend } from '@jbrowse/render-core/marks/backend'

import { WIGGLE_MARKS } from './wiggleMarks.ts'

export function WiggleRenderer(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, WIGGLE_MARKS)
}
