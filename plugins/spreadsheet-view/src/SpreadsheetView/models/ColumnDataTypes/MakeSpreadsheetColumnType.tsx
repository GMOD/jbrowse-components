import type React from 'react'
import { types } from 'mobx-state-tree'

/** utility function for assembling the MST model of a column data type */
export default function MakeSpreadsheetColumnType(
  name: string,
  {
    DataCellReactComponent = null,
    FilterModelType = null,
    compare,
    displayName = undefined,
    categoryName = undefined,
  }: {
    compare?: any
    DataCellReactComponent?: React.FC<any> | null
    FilterModelType?: any
    displayName?: string
    categoryName?: string
  },
) {
  return types
    .model(`ColumnDataType${name}`, {
      type: types.literal(name),
    })
    .volatile(() => ({
      DataCellReactComponent,
      FilterModelType: FilterModelType,
      displayName: displayName || name,
      categoryName,
    }))
    .views(() => ({
      compare,
      get hasFilter() {
        return !!FilterModelType
      },
    }))
}
