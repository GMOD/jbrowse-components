import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { Menu, MenuOption } from '@gmod/jbrowse-core/ui'

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
    spreadsheetModel: {
      rowMenuPosition: RowMenuPosition | null
      setRowMenuPosition: (n: RowMenuPosition | null) => void
    }
  }
  const RowMenu = observer(({ viewModel, spreadsheetModel }: Props) => {
    const currentRowMenu = spreadsheetModel.rowMenuPosition
    const { setRowMenuPosition } = spreadsheetModel

    const rowMenuClose = () => {
      setRowMenuPosition(null)
    }

    function handleMenuItemClick(event: React.MouseEvent, callback: Function) {
      callback(viewModel, spreadsheetModel)
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
