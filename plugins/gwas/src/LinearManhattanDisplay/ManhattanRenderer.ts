import { createMarkBackend } from '@jbrowse/render-core/marks/backend'

import { MANHATTAN_MARKS } from './manhattanMarks.ts'

export function ManhattanRenderer(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, MANHATTAN_MARKS)
}
