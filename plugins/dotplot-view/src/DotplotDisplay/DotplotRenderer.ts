import { createMarkBackend } from '@jbrowse/render-core/marks/backend'

import { DOTPLOT_MARKS } from './dotplotMarks.ts'

export function createDotplotRenderer(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, DOTPLOT_MARKS)
}
