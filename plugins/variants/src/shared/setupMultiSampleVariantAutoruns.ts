import { setupTreeDrawingAutorun } from '@jbrowse/tree-sidebar'

import { setupColorByAutorun } from './colorByAutorun.ts'
import { getMultiSampleVariantSourcesAutorun } from './getMultiSampleVariantSourcesAutorun.ts'
import { getVariantCellDataAutorun } from './getVariantCellDataAutorun.ts'

export function setupMultiSampleVariantAutoruns(self: any) {
  getMultiSampleVariantSourcesAutorun(self)
  setupTreeDrawingAutorun(self)
  setupColorByAutorun(self)
  getVariantCellDataAutorun(self)
}
