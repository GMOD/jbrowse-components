import { packInstances } from './shaders/variant.iface.generated.ts'

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
