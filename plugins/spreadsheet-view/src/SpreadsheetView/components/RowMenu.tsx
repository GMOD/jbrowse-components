import React from 'react'
import { observer } from 'mobx-react'
import { Menu, MenuItem } from '@jbrowse/core/ui'
import { InstanceOfModelReturnedBy } from '@jbrowse/core/util'

import SpreadsheetModelF from '../models/Spreadsheet'
import ViewModelF from '../models/SpreadsheetView'

export interface Props {
  viewModel: InstanceOfModelReturnedBy<typeof ViewModelF>
  spreadsheetModel: InstanceOfModelReturnedBy<typeof SpreadsheetModelF>
}

const RowMenu = observer(({ viewModel, spreadsheetModel }: Props) => {
  const currentRowMenu = spreadsheetModel.rowMenuPosition
  const { setRowMenuPosition } = spreadsheetModel

  const rowMenuClose = () => {
    setRowMenuPosition(null)
  }

  const rowNumber = spreadsheetModel.rowMenuPosition?.rowNumber
  if (rowNumber === undefined) {
    return null
  }

  const row = spreadsheetModel.rowSet.rows[rowNumber - 1]

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
        rowNumber,
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
