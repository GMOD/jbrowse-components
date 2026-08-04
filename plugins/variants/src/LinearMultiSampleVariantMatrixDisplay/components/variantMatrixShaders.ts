import { packInstances } from './shaders/variantMatrix.iface.generated.ts'

import type { VariantMatrixUploadData } from './variantMatrixRenderingBackendTypes.ts'

export function interleaveMatrixInstances(data: VariantMatrixUploadData) {
  return packInstances(
    {
      featureIndex: data.cellFeatureIndices,
      rowIndex: data.cellRowIndices,
      color: data.cellColors,
    },
    data.numCells,
  )
}
