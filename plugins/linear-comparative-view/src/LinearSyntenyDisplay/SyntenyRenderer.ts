import { createMarkBackend } from '@jbrowse/render-core/marks/backend'

import { SYNTENY_MARKS } from './syntenyMarks.ts'
import { syntenyGroundClear } from './syntenyRibbonMarks.ts'

export function SyntenyRendererFactory(canvas: HTMLCanvasElement) {
  return createMarkBackend(canvas, SYNTENY_MARKS, {
    clearColor: state => syntenyGroundClear(state.groundColor),
  })
}
