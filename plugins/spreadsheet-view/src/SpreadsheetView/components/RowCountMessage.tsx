import React from 'react'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'

// locals
import SpreadsheetStateModel from '../models/Spreadsheet'

type SpreadsheetModel = Instance<typeof SpreadsheetStateModel>

const RowCountMessage = observer(function ({
  spreadsheet,
}: {
  spreadsheet: SpreadsheetModel
}) {
  if (spreadsheet.rowSet.isLoaded) {
    const {
      passingFiltersCount,
      count,
      selectedCount,
      selectedAndPassingFiltersCount,
    } = spreadsheet.rowSet

    let rowMessage
    if (passingFiltersCount !== count) {
      rowMessage = `${spreadsheet.rowSet.passingFiltersCount} rows of ${spreadsheet.rowSet.count} total`
      if (selectedCount) {
        rowMessage += `, ${selectedAndPassingFiltersCount} selected`
        const selectedAndNotPassingFiltersCount =
          selectedCount - selectedAndPassingFiltersCount
        if (selectedAndNotPassingFiltersCount) {
          rowMessage += ` (${selectedAndNotPassingFiltersCount} selected rows do not pass filters)`
        }
      }
    } else {
      rowMessage = `${spreadsheet.rowSet.count} rows`
      if (selectedCount) {
        rowMessage += `, ${selectedCount} selected`
      }
    }
    return <>{rowMessage}</>
  }
  return null
})
export default RowCountMessage
