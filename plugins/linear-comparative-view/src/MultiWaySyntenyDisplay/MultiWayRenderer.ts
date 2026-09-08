import { createMarkBackend } from '@jbrowse/render-core/marks/backend'

import { MULTIWAY_MARKS } from './multiwayMarks.ts'

export function MultiWayRenderer(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, MULTIWAY_MARKS)
}
