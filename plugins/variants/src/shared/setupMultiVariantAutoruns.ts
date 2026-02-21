import { setupColorByAutorun } from './colorByAutorun.ts'
import { getMultiVariantSourcesAutorun } from './getMultiVariantSourcesAutorun.ts'
import { getWebGLVariantCellDataAutorun } from './getWebGLVariantCellDataAutorun.ts'
import { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'

export function setupMultiVariantAutoruns(self: any) {
  getMultiVariantSourcesAutorun(self)
  setupTreeDrawingAutorun(self)
  setupColorByAutorun(self)
  getWebGLVariantCellDataAutorun(self)
}
