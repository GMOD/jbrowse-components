import React from 'react'
import { observer } from 'mobx-react'
import { Menu, MenuItem } from '@jbrowse/core/ui'
import { Instance } from 'mobx-state-tree'

// locals
import SpreadsheetModel from '../models/Spreadsheet'
import ViewModel from '../models/SpreadsheetView'

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
        row,
      )
      return { ...item, disabled }
    }
    return item
  })

  return (
    <Menu
      anchorEl={currentRowMenu && currentRowMenu.anchorEl}
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
