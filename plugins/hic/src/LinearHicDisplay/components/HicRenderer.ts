import { createMarkBackend } from '@jbrowse/render-core/marks/backend'

import { HIC_MARKS } from './hicMarks.ts'

export function HicRenderer(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, HIC_MARKS)
}
