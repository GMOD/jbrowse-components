import React from 'react'
import { observer } from 'mobx-react'
import { iterMap } from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'

// icons
import CheckIcon from '@mui/icons-material/Check'
import FilterListIcon from '@mui/icons-material/FilterList'
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting'
import SortIcon from '@mui/icons-material/Sort'

const ColumnMenu = observer(
  ({ viewModel, spreadsheetModel, currentColumnMenu, setColumnMenu }) => {
    const columnMenuClose = () => {
      setColumnMenu(null)
    }

    function handleMenuItemClick(event, callback) {
      callback()
      columnMenuClose(null)
    }

    const columnNumber = currentColumnMenu && currentColumnMenu.colNumber

    const sortMenuClick = descending => {
      spreadsheetModel.setSortColumns([
        {
          columnNumber,
          descending,
        },
      ])
    }

    const filterMenuClick = () => {
      viewModel.filterControls.addBlankColumnFilter(columnNumber)
    }

    const { dataTypeChoices } = spreadsheetModel

    // make a Map of categoryName => [entry...]
    const dataTypeTopLevelMenu = new Map()
    dataTypeChoices.forEach(dataTypeRecord => {
      const { displayName, categoryName } = dataTypeRecord
      if (categoryName) {
        if (!dataTypeTopLevelMenu.has(categoryName)) {
          dataTypeTopLevelMenu.set(categoryName, {
            isCategory: true,
            subMenuItems: [],
          })
        }
        dataTypeTopLevelMenu.get(categoryName).subMenuItems.push(dataTypeRecord)
      } else {
        dataTypeTopLevelMenu.set(displayName, dataTypeRecord)
      }
    })

    const dataType =
      currentColumnMenu && spreadsheetModel.columns[columnNumber].dataType
    const dataTypeName = (dataType && dataType.type) || ''
    const dataTypeDisplayName =
      (currentColumnMenu &&
        spreadsheetModel.columns[columnNumber].dataType.displayName) ||
      ''

    const isSortingAscending = Boolean(
      spreadsheetModel.sortColumns.length &&
        currentColumnMenu &&
        spreadsheetModel.sortColumns.find(
          col =>
            col.columnNumber === currentColumnMenu.colNumber && !col.descending,
        ),
    )
    const isSortingDescending = Boolean(
      spreadsheetModel.sortColumns.length &&
        currentColumnMenu &&
        spreadsheetModel.sortColumns.find(
          col =>
            col.columnNumber === currentColumnMenu.colNumber && col.descending,
        ),
    )
    function stopSortingClick() {
      columnMenuClose()
      spreadsheetModel.setSortColumns([])
    }

    const menuItems = [
      // top-level column menu
      {
        label: 'Sort ascending',
        icon: SortIcon,
        type: 'radio',
        checked: isSortingAscending,
        onClick: isSortingAscending
          ? stopSortingClick
          : sortMenuClick.bind(null, false),
      },
      {
        label: 'Sort descending',
        icon: SortIcon,
        type: 'radio',
        checked: isSortingDescending,
        onClick: isSortingDescending
          ? stopSortingClick
          : sortMenuClick.bind(null, true),
      },
      // data type menu
      {
        label: `Type: ${dataTypeDisplayName}`,
        icon: PermDataSettingIcon,
        subMenu: iterMap(
          dataTypeTopLevelMenu.entries(),
          ([displayName, record]) => {
            const { subMenuItems, typeName } = record
            if (typeName) {
              const menuEntry = {
                label: displayName || typeName,
                onClick: () => {
                  spreadsheetModel.setColumnType(columnNumber, typeName)
                },
              }
              if (dataTypeName === typeName) {
                menuEntry.icon = CheckIcon
              }
              return menuEntry
            }
            if (subMenuItems) {
              return {
                label: displayName,
                icon: subMenuItems.find(i => i.typeName === dataTypeName)
                  ? CheckIcon
                  : undefined,
                subMenu: subMenuItems.map(
                  ({ typeName: subTypeName, displayName: subDisplayName }) => ({
                    label: subDisplayName,
                    icon: subTypeName === dataTypeName ? CheckIcon : undefined,
                    onClick: () => {
                      spreadsheetModel.setColumnType(columnNumber, subTypeName)
                    },
                  }),
                ),
              }
            }
            return null
          },
        ).filter(Boolean),
      },
    ]

    // don't display the filter item if this data type doesn't have filtering
    // implemented
    if (dataType && dataType.hasFilter) {
      menuItems.push({
        label: 'Create filter',
        icon: FilterListIcon,
        onClick: filterMenuClick.bind(null, true),
      })
    }

    return (
      <Menu
        anchorEl={currentColumnMenu && currentColumnMenu.anchorEl}
        open={Boolean(currentColumnMenu)}
        onMenuItemClick={handleMenuItemClick}
        onClose={columnMenuClose}
        menuItems={menuItems}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      />
    )
  },
)

export default ColumnMenu
