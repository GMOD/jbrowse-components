import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { Menu, MenuOption } from '@gmod/jbrowse-core/ui'
import { InstanceOfModelReturnedBy } from '@gmod/jbrowse-core/util'

import SpreadsheetModelF from '../models/Spreadsheet'
import ViewModelF from '../models/SpreadsheetView'

export default (pluginManager: PluginManager) => {
  const { lib } = pluginManager
  const { observer } = lib['mobx-react']
  const React = lib.react

  interface RowMenuPosition {
    anchorEl: Element
    rowNumber: number
  }

  interface Props {
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
    if (rowNumber === undefined) return null

    const row = spreadsheetModel.rowSet.rows[rowNumber - 1]

    function handleMenuItemClick(event: React.MouseEvent, callback: Function) {
      callback(viewModel, spreadsheetModel, rowNumber, row)
      rowMenuClose()
    }

    // got through and evaluate all the `disabled` callbacks of the menu items
    const menuItems: MenuOption[] = viewModel.rowMenuItems.map(item => {
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
        menuOptions={menuItems}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      />
    )
  })
  return RowMenu
}
