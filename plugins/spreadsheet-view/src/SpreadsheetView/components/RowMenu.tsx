import React from 'react'
import { Menu } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// locals
import type SpreadsheetModel from '../models/Spreadsheet'
import type ViewModel from '../models/SpreadsheetView'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Instance } from 'mobx-state-tree'

const RowMenu = observer(function ({
  viewModel,
  spreadsheetModel,
}: {
  viewModel: Instance<typeof ViewModel>
  spreadsheetModel: Instance<typeof SpreadsheetModel>
}) {
  const currentRowMenu = spreadsheetModel.rowMenuPosition
  const { setRowMenuPosition } = spreadsheetModel

  const rowMenuClose = () => {
    setRowMenuPosition(null)
  }

  const rowNumber = spreadsheetModel.rowMenuPosition?.rowNumber
  if (rowNumber === undefined) {
    return null
  }

  const row = spreadsheetModel.rowSet.rows[+rowNumber - 1]
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  function handleMenuItemClick(_event: unknown, callback: Function) {
    callback(viewModel, spreadsheetModel, rowNumber, row)
    rowMenuClose()
  }

  // got through and evaluate all the `disabled` callbacks of the menu items
  const menuItems: MenuItem[] = viewModel.rowMenuItems.map(item => {
    if (typeof item.disabled === 'function') {
      const disabled = item.disabled(
        viewModel,
        spreadsheetModel,
        +rowNumber,
        row!,
      )
      return { ...item, disabled }
    }
    return item
  })

  return (
    <Menu
      anchorEl={currentRowMenu?.anchorEl}
      open={Boolean(currentRowMenu)}
      onMenuItemClick={handleMenuItemClick}
      onClose={rowMenuClose}
      menuItems={menuItems}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
    />
  )
})

export default RowMenu
