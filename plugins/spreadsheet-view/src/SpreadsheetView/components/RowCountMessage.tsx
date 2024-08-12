import React from 'react'
import { observer } from 'mobx-react'

// locals
import type { SpreadsheetModel } from '../models/Spreadsheet'

const RowCountMessage = observer(function ({
  spreadsheet,
}: {
  spreadsheet: SpreadsheetModel
}) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (spreadsheet.rowSet.isLoaded) {
    const {
      passingFiltersCount,
      count,
      selectedCount,
      selectedAndPassingFiltersCount,
    } = spreadsheet.rowSet

    let rowMessage: string
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
