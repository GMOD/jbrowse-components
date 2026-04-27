import { setupTreeDrawingAutorun } from '@jbrowse/tree-sidebar'

import { setupColorByAutorun } from './colorByAutorun.ts'
import { getMultiSampleVariantSourcesAutorun } from './getMultiSampleVariantSourcesAutorun.ts'

// Sets up reactive computations that fire alongside (not instead of) the
// standard cellData fetch pipeline. The cellData fetch itself uses the
// standard fetchRegions / fetchNeeded path in MultiSampleVariantBaseModel;
// these handle separate concerns:
//   - sources: one-shot fetch per adapter (independent of viewport)
//   - tree drawing: async clustering derived from cellData
//   - colorBy: per-genotype color derivation from cellData + settings
export function setupMultiSampleVariantAutoruns(self: any) {
  getMultiSampleVariantSourcesAutorun(self)
  setupTreeDrawingAutorun(self)
  setupColorByAutorun(self)
}
