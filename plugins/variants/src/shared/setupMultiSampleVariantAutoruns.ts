import { setupTreeDrawingAutorun } from '@jbrowse/tree-sidebar'

import { setupColorByAutorun } from './colorByAutorun.ts'
import { getMultiSampleVariantSourcesAutorun } from './getMultiSampleVariantSourcesAutorun.ts'

type Self = Parameters<typeof getMultiSampleVariantSourcesAutorun>[0] &
  Parameters<typeof setupTreeDrawingAutorun>[0] &
  Parameters<typeof setupColorByAutorun>[0]

export function setupMultiSampleVariantAutoruns(self: Self) {
  getMultiSampleVariantSourcesAutorun(self)
  setupTreeDrawingAutorun(self)
  setupColorByAutorun(self)
}
