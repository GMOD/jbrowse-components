import React from 'react'
import { observer } from 'mobx-react'
import type SpreadsheetStateModel from '../Spreadsheet'
import type SpreadsheetStateModel from '../models/Spreadsheet'
import type { Instance } from 'mobx-state-tree'

// locals

type SpreadsheetModel = Instance<typeof SpreadsheetStateModel>

const CellData = observer(function ({
  cell,
  spreadsheetModel,
  columnNumber,
}: {
  cell: any
  spreadsheetModel: SpreadsheetModel
  columnNumber: number
}) {
  const column = spreadsheetModel.columns[columnNumber]
  return cell.text
})

export default CellData
