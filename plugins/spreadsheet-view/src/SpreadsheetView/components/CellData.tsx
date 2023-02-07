import React from 'react'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'

// locals
import SpreadsheetStateModel from '../models/Spreadsheet'

type SpreadsheetModel = Instance<typeof SpreadsheetStateModel>

const CellData = observer(function ({
  cell,
  spreadsheetModel,
  columnNumber,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cell: any
  spreadsheetModel: SpreadsheetModel
  columnNumber: number
}) {
  const ret = spreadsheetModel.columns[columnNumber]
  if (ret && 'dataType' in ret && ret.dataType.DataCellReactComponent) {
    return (
      <ret.dataType.DataCellReactComponent
        cell={cell}
        dataType={ret.dataType}
        columnNumber={columnNumber}
        spreadsheet={spreadsheetModel}
      />
    )
  }

  return cell.text
})

export default CellData
