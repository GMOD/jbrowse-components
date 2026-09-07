import { createMarkBackend } from '@jbrowse/render-core/marks/backend'

import { LD_MARKS } from './ldMarks.ts'

export function LDRenderer(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, LD_MARKS)
}
