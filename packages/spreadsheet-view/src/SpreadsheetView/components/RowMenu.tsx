import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { Menu, MenuOption } from '@gmod/jbrowse-core/ui'
import { InstanceOfModelReturnedBy } from '@gmod/jbrowse-core/util'

import SpreadsheetModelF from '../models/Spreadsheet'

export default (pluginManager: PluginManager) => {
  const { lib } = pluginManager
  const { observer } = lib['mobx-react']
  const React = lib.react

  interface RowMenuPosition {
    anchorEl: Element
    rowNumber: number
  }

  interface Props {
    viewModel: { rowMenuItems: MenuOption[] }
    spreadsheetModel: InstanceOfModelReturnedBy<typeof SpreadsheetModelF>
  }
  const RowMenu = observer(({ viewModel, spreadsheetModel }: Props) => {
    const currentRowMenu = spreadsheetModel.rowMenuPosition
    const { setRowMenuPosition } = spreadsheetModel

    const rowMenuClose = () => {
      setRowMenuPosition(null)
    }

    function handleMenuItemClick(event: React.MouseEvent, callback: Function) {
      const rowNumber = spreadsheetModel.rowMenuPosition?.rowNumber
      let row
      if (rowNumber !== undefined) {
        row = spreadsheetModel.rowSet.rows[rowNumber - 1]
      }

      callback(viewModel, spreadsheetModel, rowNumber, row)
      rowMenuClose()
    }

    return (
      <Menu
        anchorEl={currentRowMenu && currentRowMenu.anchorEl}
        open={Boolean(currentRowMenu)}
        onMenuItemClick={handleMenuItemClick}
        onClose={rowMenuClose}
        menuOptions={viewModel.rowMenuItems}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      />
    )
  })
  return RowMenu
}
