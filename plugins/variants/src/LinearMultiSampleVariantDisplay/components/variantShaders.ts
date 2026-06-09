import { packInstances } from './shaders/variant.generated.ts'

import type { VariantUploadData } from './variantRenderingBackendTypes.ts'

export function interleaveVariantInstances(data: VariantUploadData) {
  return packInstances(
    {
      startEnd: data.cellPositions,
      rowIndex: data.cellRowIndices,
      shapeType: data.cellShapeTypes,
      color: data.cellColors,
    },
    data.numCells,
  )
}
