import { createMarkBackend } from '@jbrowse/render-core/marks'

import { MANHATTAN_MARKS } from './manhattanMarks.ts'

export function ManhattanRenderer(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, MANHATTAN_MARKS)
}
