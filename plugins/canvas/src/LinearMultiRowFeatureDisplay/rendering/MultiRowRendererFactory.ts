import { createMarkBackend } from '@jbrowse/render-core/marks/backend'

import { MULTI_ROW_MARKS } from './multiRowMarks.ts'

export function MultiRowRendererFactory(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, MULTI_ROW_MARKS)
}
